var collection = require("./collection.js");
var Courses = collection.Courses;

var saveCourse = function(uid, name, info) {
    var course = {};
    course.uid = uid;
    course.name = name;
    course.info = info;
    Courses.insert(course);
}

var teacherCourse = function(uid) {
    return Courses.find({uid:uid}).fetch();
}

exports.saveCourse = saveCourse;
exports.teacherCourse = teacherCourse;
