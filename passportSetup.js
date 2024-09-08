require('dotenv').config()
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const AmazonStrategy = require('passport-amazon').Strategy;

const { createToken } = require('./helpers/tokens')

const UserService = require('./models/UserService');



passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await UserService.findOrCreateOIDCUser({
            providerName: 'google',
            providerUserId: profile.id,
            email: profile.emails[0].value,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            accessToken,
            refreshToken,
            profileImagePath: profile.photos[0].value
        });

        return done(null, user);

    } catch (e) {
        return done(e, false);
    }
}));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL,
    profileFields: ['id', 'emails', 'name', 'photos']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await UserService.findOrCreateOIDCUser({
            providerName: 'facebook',
            providerUserId: profile.id,
            email: profile.emails[0].value,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            accessToken,
            refreshToken,
            profileImagePath: profile.photos[0].value
        });

        return done(null, user);
    } catch (e) {
        return done(e, false);
    }
}));

// Amazon auth account not set up yet. 
// passport.use(new AmazonStrategy({
//     clientID: process.env.FACEBOOJ_CLIENT_ID,
//     clientSecret: process.env.FACEBOOJ_CLIENT_SECRET,
//     callbackURL: process.env.FACEBOOJ_CALLBACK_URL,
// }, async (accessToken, refreshToken, profile, done)=>{
//     try{
//         const user = await UserService.findOrCreateOIDCUser({
//             providerName:'amazon',
//             profileUserId: profile.id,
//             email: profile.emails[0].value,
//             firstName: profile.name.givenName,
//             lastName: profile.name.familyName,
//             accessToken,
//             refreshToken,
//             profileImagePath: profile.photos[0].value
//         });

//         
//         return done(null, user);
//     }catch(e){
//         return done(e, false);
//     }
// }));

passport.serializeUser((user, done) => {
    done(null, user.id);
})

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (e) {
        done(e, false)
    }
})