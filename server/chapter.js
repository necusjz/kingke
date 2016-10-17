var collection = require('./collection.js');
var Chapters = collection.Chapters;

/**
 * save chapter info to database.
 * @param  {String} cid Courses._id
 * @param  {String} name chapter name
 * @param  {String} info chapter info
 * @returns {NULL} NULL
 */
var saveChapter = function(cid, name, info) {
  var chapter = {};
  chapter.cid = cid;
  chapter.name = name;
  chapter.info = info;
  Chapters.insert(chapter);
};

/**
 * get a course's chapterList
 * @param  {String} cid Courses._id
 * @returns {Array} chapter list
 */
var courseChapters = function(cid) {
  return Chapters.find({ cid: cid }).fetch();
};

/**
 * get Chapters by _id.
 * @param  {String} id Chapters._id
 * @returns {Object} chapter detail
 */
var chapterInfo = function(id) {
  return Chapters.findOne({ _id: id });
};

exports.saveChapter = saveChapter;
exports.courseChapters = courseChapters;
exports.chapterInfo = chapterInfo;
