var collection = require("./collection.js");
var Courses = collection.Courses;

var saveCourse = function(uid, name, info) {
    var course = {};
    course.uid = uid;
    course.name = name;
    course.info = info;
    //TODO chapter null
    Courses.insert(course);
}

var teacherCourse = function(uid) {
    return Courses.find({uid:uid}).fetch();
}

var courseInfo = function(id) {
    return Courses.findOne({_id:id});
}

exports.saveCourse = saveCourse;
exports.teacherCourse = teacherCourse;
exports.courseInfo = courseInfo;
