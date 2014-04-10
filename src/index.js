var goauth = require('goauth');
var twitter_profile = require('twitter-profile');

module.exports = function(config, $digger){
	var self = this;

	config = config || {};

	if(!config.warehouse){
		throw new Error('auth module requires a warehouse option')
	}

	/*

			connect to the backend warehouse that contains our users
		
	*/

	var userwarehouse = typeof(config.warehouse)=='string' ? $digger.connect(config.warehouse) : config.warehouse;

	/*
	
		load the user with the given username to use for login and register check
		
	*/
	function load_user(username, callback){
		/*
		
			load the user based on the username -> id
			
		*/
		userwarehouse('[username=' + username + ']')
			.ship(function(user){
				if(user.isEmpty()){
					callback('no user found');
				}
				else{
					callback(null, user);
				}
			})
			.fail(function(error){
				callback(error);
			})
	}

	/*
	
		load a user from a provider id
		
	*/
	function load_provider_user(provider, id, callback){
		/*
		
			load the user based on the username -> id
			
		*/
		userwarehouse('[' + provider + '_id=' + id + ']')
			.ship(function(user){
				if(user.isEmpty()){
					callback('no user found');
				}
				else{
					callback(null, user);
				}
			})
			.fail(function(error){
				callback(error);
			})
	}

	/*
	
		load a user from a provider id
		
	*/
	function load_id_user(id, callback){
		/*
		
			load the user based on the username -> id
			
		*/
		userwarehouse('=' + id)
			.ship(function(user){
				if(user.isEmpty()){
					callback('no user found');
				}
				else{
					callback(null, user);
				}
			})
			.fail(function(error){
				callback(error);
			})
	}	

	/*
	
		insert a new user into the warehouse
		
	*/
	function create_user(data, callback){

		data._password = data.password;
		delete(data.password);

		var user = $digger.container('user', data);

		userwarehouse
			.append(user)
			.ship(function(){
				callback(null, user.get(0));
			})
			.fail(function(error){
				callback(error);
			})
		
	}

	/*
	
		the goauth setup
		
	*/
	var auth = goauth(config);

	auth.on('login', function(data, callback){

		load_user(data.username, function(error, user){
			
			if(error || !user || user.attr('_password')!=data.password){
				callback('invalid details');
			}
			else{
				callback(null, user.get(0));
			}
		})

	})

	auth.on('register', function(data, callback){
		load_user(data.username, function(error, user){
			
			if(!error || user){
				callback('user ' + data.username + ' already exists')
				return;
			}

			create_user(data, callback);

		})
	})

	auth.on('update', function(user, data, callback){
		load_user(user.username, function(error, user){

			if(!user){
				error = 'no user found';
			}

			if(error){
				callback(error);
				return;
			}

			for(var prop in data){
				user.attr(prop, data[prop]);
			}

			user
				.save()
				.ship(function(){
					callback(null, true);
				})
				.fail(function(error){
					callback(error);
				})

		})
	})
	
	var extractors = {
		github:function(packet){
			var data = packet.data;
			return {
				name:data.name,
				id:data.login,
				image:data.avatar_url,
				email:data.email
			}
		},
		dropbox:function(packet){
			var data = packet.data;
			return {
				name:data.display_name,
				id:data.uid,
				email:data.email
			}
		},
		google:function(packet){
			var data = packet.data;
			return {
				name:data.name,
				id:data.id,
				image:data.picture
			}
		},
		facebook:function(packet){
			var data = packet.data;
			return {
				id:data.id,
				name:data.name,
				image:'http://graph.facebook.com/' + data.id + '/picture'
			}
		},
		twitter:function(packet, done){
			var data = packet.data;
			var options = {
				username:data.screen_name,
				userid:data.user_id,
				oauth_token:packet.token,
				oauth_secret:packet.secret,
				consumer_key:config.providers.twitter.id,
				consumer_secret:config.providers.twitter.secret
			}
			twitter_profile(options, function(error, twitteruser){
				if(error){
					return done(error);
				}
				
				var user = {
					id:data.user_id,
					image:twitteruser.profile_image_url,
					name:data.screen_name
				}

				done(null, user);
			})
			
		}
	}

	auth.on('connect', function(user, packet, callback){

		var service = packet.service;

		if(!extractors[service]){
			callback(service + ' is an unknown provider');
			return;
		}

		function save_user(diggeruser){
			// already logged in
			if(user){

				var existingid = user._digger.diggerid;

				load_provider_user(service, diggeruser.id, function(error, dbuser){

					// we don't mind that here
					if(error=='no user found'){
						error = null;
					}

					if(error){
						callback(error);
						return;
					}

					// we know them from this provider already
					if(dbuser){
						// but there is a crossed account
						if(dbuser.diggerid()!=existingid){
							callback('There is another account that is logged in with that ' + service + ' id');
							return
						}

						dbuser.attr(service + '_id', diggeruser.id);
						dbuser.attr(service + '_user', diggeruser);
						//dbuser.attr(service + '_data', data);
						dbuser.attr(service + '_tokens', {
							token:packet.token,
							refresh_token:packet.refresh_token
						})

						dbuser.save().ship(function(){
							callback(null, dbuser.get(0));
						})
					}
					// a new service connecting to an existing account
					else{

						// load the full user from the db
						load_id_user(user._digger.diggerid, function(error, dbuser){
							if(error || !dbuser){
								callback('user logged in but no databases record found');
								return;
							}
							dbuser.attr(service + '_id', diggeruser.id);
							dbuser.attr(service + '_user', diggeruser);
							//dbuser.attr(service + '_data', data);
							dbuser.attr(service + '_tokens', {
								token:packet.token,
								refresh_token:packet.refresh_token
							})

							dbuser.save().ship(function(){
								callback(null, dbuser.get(0));
							})
						})

						
					}
				})
			}
			// not logged in
			else{

				load_provider_user(service, diggeruser.id, function(error, dbuser){

					// we don't mind that here
					if(error=='no user found'){
						error = null;
					}

					if(error){
						callback(error);
						return;
					}

					// we know them
					if(dbuser){
						dbuser.attr(service + '_id', diggeruser.id);
						dbuser.attr(service + '_user', diggeruser);
						//dbuser.attr(service + '_data', data);
						dbuser.attr(service + '_tokens', {
							token:packet.token,
							refresh_token:packet.refresh_token
						})

						dbuser.save().ship(function(){
							callback(null, dbuser.get(0));
						})
					}
					else{

						var createdata = {};

						createdata[service + '_id'] = diggeruser.id;
						createdata[service + '_user'] = diggeruser;
						//createdata[service + '_data'] = data;
						createdata[service + '_tokens'] = {
							token:packet.token,
							refresh_token:packet.refresh_token
						}

						create_user(createdata, function(error, dbuser){
							callback(null, dbuser);
						});
					}
					
				})
			}
		}

		var extractor = extractors[service];

		if(extractor.length>=2){
			extractor(packet, function(error, _diggeruser){
				if(error){
					return callback(error);
				}

				save_user(_diggeruser);

			})
		}
		else{
			var _diggeruser = extractors[service](packet);
			save_user(_diggeruser);
		}
		

	})

	return auth;
}