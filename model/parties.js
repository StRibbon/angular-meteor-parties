Parties = new Mongo.Collection("parties");

Parties.allow({
  insert: function (userId, party) {
    return userId && party.owner === userId;
  },
  update: function (userId, party, fields, modifier) {
    return userId && party.owner === userId;
  },
  remove: function (userId, party) {
    return userId && party.owner === userId;
  }
});

Meteor.methods({
  invite: function (partyId, userId) {
    check(partyId, String);
    check(userId, String);
    var party = Parties.findOne(partyId);
    if (!party)
      throw new Meteor.Error(404, "No such party");
    if (party.owner !== this.userId)
      throw new Meteor.Error(404, "No such party");
    if (party.public)
      throw new Meteor.Error(400,
        "That party is public. No need to invite people.");
 
    if (userId !== party.owner && ! _.contains(party.invited, userId)) {
      Parties.update(partyId, { $addToSet: { invited: userId } });
      var from = 'stribbon@icloud.com';
      var to = 'spaceribbon@gmail.com';
      // var from = contactEmail(Meteor.users.findOne(this.userId));
      // var to = contactEmail(Meteor.users.findOne(userId));
 
      if (Meteor.isServer && to) {
        // This code only runs on the server. If you didn't want clients
        // to be able to see it, you could move it to a separate file.
        process.env.MAIL_URL = 'smtp://stribbon@icloud.com:rQTKMZMP9N3oQIRhmRqHSQ@smtp.mandrillapp.com:587';
        Email.send({
          from: "noreply@socially.com",
          to: to,
          replyTo: from || undefined,
          subject: "PARTY: " + party.name,
          text:
          "Hey, I just invited you to '" + party.name + "' on Socially." +
          "\n\nCome check it out: " + Meteor.absoluteUrl() + "\n"
        });
      }
    }
  },
  rsvp: function (partyId, rsvp){
    check(partyId, String);
    check(rsvp, String);
    if (!this.userId)
      throw new Meteor.Error(403, "You must be logged in to RSVP");
    if (! _.contains(['yes', 'no', 'maybe'], rsvp))
      throw new Meteor.Error(400, "Invalid RSVP");
    var party = Parties.findOne(partyId);
    if (! party)
      throw new Meteor.Error(404, "No such party");
    if (! party.public && party.owner !== this.userId && !_.contains(party.invited, this.userId))
      //private, but we don't tell user
    throw new Meteor.Error(403, "No such party");

    var rsvpIndex = _.indexOf(_.pluck(party.rsvps,'user'), this.userId);
    if (rsvpIndex !== -1){
      //update existing rsvp entry
      if (Meteor.isServer){
      Parties.update(
        {_id: partyId, "rsvps.user": this.userId},
        {$set: {"rsvps.$.rsvp": rsvp}});
      } else {
        // minimongo doesn't support $ in modifier, use index since only 1 thread
        var modifier = {$set: {}};
        modifier.$set["rsvp."+rsvpIndex+".rsvp"] = rsvp;
        Parties.update(partyId, modifier);
      }
      // possible improvement: send email to other people that are coming
    } else {
      Parties.update(partyId, 
        {$push: {rsvps: {user: this.userId, rsvp: rsvp}}});
    }
  }
});
 
var contactEmail = function (user) {
  if (user.emails && user.emails.length)
    return user.emails[0].address;
  if (user.services && user.services.facebook && user.services.facebook.email)
    return user.services.facebook.email;
  return null;
};