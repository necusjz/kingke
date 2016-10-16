var collection = require('./collection.js');
var Courses = collection.Courses;
var Ids = collection.Ids;

var saveCourse = function(uid, name, info) {
  var course = {};
  course.uid = uid;
  course.name = name;
  course.info = info;
  // TODO chapter null
  if (!Ids.findOne({ name: 'course' })) {
    Ids.insert({ name: 'course', id: 1000000 });
  }
  var id = Ids.findOne({ name: 'course' });
  course.qrcodeid = id.id + 1;
  Ids.update({ name: 'course' }, { $inc: { id: 1 } });
  Courses.insert(course);
};

var teacherCourse = function(uid) {
  return Courses.find({ uid: uid }).fetch();
};

var studentCourse = function(openid) {
  return Courses.find({ student: openid }).fetch();
};

var courseInfo = function(id) {
  return Courses.findOne({ _id: id });
};

exports.saveCourse = saveCourse;
exports.teacherCourse = teacherCourse;
exports.studentCourse = studentCourse;
exports.courseInfo = courseInfo;
