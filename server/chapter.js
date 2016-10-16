var collection = require('./collection.js');
var Chapters = collection.Chapters;

var saveChapter = function(cid, name, info) {
  var chapter = {};
  chapter.cid = cid;
  chapter.name = name;
  chapter.info = info;
  // TODO chapter null
  Chapters.insert(chapter);
};

var courseChapters = function(cid) {
  return Chapters.find({ cid: cid }).fetch();
};

var chapterInfo = function(id) {
  return Chapters.findOne({ _id: id });
};

exports.saveChapter = saveChapter;
exports.courseChapters = courseChapters;
exports.chapterInfo = chapterInfo;
