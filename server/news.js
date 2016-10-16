var collection = require('./collection.js');
var News = collection.News;

var saveNews = function(openid, infoBegin, course, teacher, time, infoEnd) {
  var news = {};
  news.openid = openid;
  news.infoBegin = infoBegin;
  news.course = course;
  news.teacher = teacher;
  news.time = time;
  news.infoEnd = infoEnd;
  News.insert(news);
};

var userNews = function(openid) {
  return News.find({ openid: openid }).fetch();
};

exports.saveNews = saveNews;
exports.userNews = userNews;
