digger-security-guard
=====================

OAuth manager for digger servers - connects to a digger warehouse for storage

```js
var Security = require('digger-security-guard');
var $digger = ...; // a digger client from somewhere

// security
var auth = Security({
	id: "/auth",
	warehouse: "/users",
	paths:{
		post_login:"/scripts/post_login"
	},
	providers:{
		google:{
			id:process.env.DIGGER_GOOGLE_ID,
			secret:process.env.DIGGER_GOOGLE_SECRET
		},
		facebook:{
			id:process.env.DIGGER_FACEBOOK_ID,
			secret:process.env.DIGGER_FACEBOOK_SECRET
		},
		twitter:{
			id:process.env.DIGGER_TWITTER_ID,
			secret:process.env.DIGGER_TWITTER_SECRET
		}
	}
}, $digger)

return auth;
```