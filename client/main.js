import './main.html';
var collection = require('../collection/message.js');
var Messages = collection.Messages;

Router.route('/', function() {
  this.render('Home');
});

Router.route('/chat', function() {
  this.render('Chat');
});

Template.Chat.helpers({
  messages: function() {
    return Messages.find({}, { sort: { time: -1 } });
  }
});

sendMessage = function() {
  var name = '陌生人';
  var message = document.getElementById('message');
  if (message.value !== '') {
    Messages.insert({
      name: name,
      message: message.value,
      time: Date.now(),
    });

    document.getElementById('message').value = '';
    message.value = '';
  }
};

Template.Chat.events = {
  'keydown input#message': function(event) {
    if (event.which === 13) {
      sendMessage();
    }
  }
};
