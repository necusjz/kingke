import { Meteor } from 'meteor/meteor';
var config = require('./config.js');
var collection = require('./collection.js');
var Users = collection.Users;
var Courses = collection.Courses;
var Ids = collection.Ids;
var wx = require('./wx.js');
var courseService = require('./course.js');
var chapterService = require('./chapter.js');
var newsService = require('./news.js');
var marked = require('marked');
var check = [];

Meteor.startup(() => {
  if (Meteor.isServer) {
    // 修改iron:router,以满足xml请求
    Router.configureBodyParsers = function() {
      Router.onBeforeAction(Iron.Router.bodyParser.json());
      Router.onBeforeAction(Iron.Router.bodyParser.urlencoded({extended: false}));
      // Enable incoming XML requests for creditReferral route
      Router.onBeforeAction(
        Iron.Router.bodyParser.raw({
          type: '*/*',
          verify: function(req, res, body) {
            req.rawBody = body.toString();
          }
        }),
        {
          only: ['weixin'],
          where: 'server'
        }
      );
    };

    // 自动设置meteor菜单
    var setMenuResponse = wx.setMenu();
    console.log(setMenuResponse);
  }

  Router.route('/weixin', {where: 'server'})
    .get(function() {
      var res = this.response;
      var signature = this.params.query.signature;
      var timestamp = this.params.query.timestamp;
      var nonce = this.params.query.nonce;
      var echostr = this.params.query.echostr;
      var l = [];
      l[0] = nonce;
      l[1] = timestamp;
      l[2] = config.token;
      l.sort();
      var original = l.join('');
      var sha = CryptoJS.SHA1(original).toString();
      if (signature === sha) {
        res.end(echostr);
      } else {
        res.end('false');
      }
    })
    .post(function() {
      var result = xml2js.parseStringSync(this.request.rawBody);
      var repeat = result.xml.FromUserName.join('') + result.xml.CreateTime.join('');
      var dothing = true;
      for (var x in check) {
        if (check[x] === repeat) {
          dothing = false;
          break;
        }
      }
      if (result.xml && dothing) {
        check.push(repeat);
        if (result.xml.Event[0] === 'subscribe') {
          var message = {};
          message.xml = {};
          message.xml.ToUserName = result.xml.FromUserName;
          message.xml.FromUserName = result.xml.ToUserName;
          message.xml.CreateTime = result.xml.CreateTime;
          message.xml.MsgType = 'text';
          message.xml.Content = '感谢您的关注';

          if (!Ids.findOne({name: 'user'})) {
            Ids.insert({name: 'user', id: 0});
          }

          if (!Users.findOne({openid: result.xml.FromUserName[0]})) {
            var user = {};
            var id = Ids.findOne({'name': 'user'});
            user.uid = id.id + 1;
            Ids.update({'name': 'user'}, {$inc: {id: 1}});
            user.openid = result.xml.FromUserName[0];
            // TODO user null
            // TODO refactor user model
            Users.insert(user);
          }
        }
        if (result.xml.EventKey && result.xml.EventKey.join('') && (result.xml.Event[0] === 'subscribe' || result.xml.Event[0] === 'SCAN')) {
          var qrcodeid = result.xml.EventKey.join('');
          qrcodeid = qrcodeid.replace(/qrscene_/, '');
          qrcodeid = parseInt(qrcodeid, 10);
          var templateData;
          if (qrcodeid < 1000000) {
            var followid = qrcodeid;
            var teacher = Users.findOne({uid: followid});
            teacher = wx.getUserInfo(teacher.openid);
            var student = wx.getUserInfo(result.xml.FromUserName[0]);

            templateData = {
              text: {
                value: '你已关注 ' + teacher.nickname,
                color: '#173177'
              }
            };
            wx.sendTemplate(student.openid, config.follow_template_id, null, templateData);

            if (!Users.findOne({openid: teacher.openid, follower: student.openid})) {
              templateData = {
                text: {
                  value: '你已被 ' + student.nickname + ' 关注',
                  color: '#173177'
                }
              };
              wx.sendTemplate(teacher.openid, config.follow_template_id, null, templateData);
              Users.update({openid: teacher.openid}, {$push: {follower: student.openid}});
            }
          } else {
            var course = Courses.findOne({qrcodeid: qrcodeid});

            templateData = {
              text: {
                value: '你已加入《' + course.name + '》',
                color: '#173177'
              }
            };
            student = wx.getUserInfo(result.xml.FromUserName[0]);
            wx.sendTemplate(
              student.openid,
              config.follow_template_id,
              config.url + '/course_info_student/' + course._id,
              templateData);

            if (!Courses.findOne({_id: course._id, student: student.openid})) {
              Courses.update({_id: course._id}, {$push: {student: student.openid}});
            }
          }
        }
      }
      this.response.end('');
    });

  Router.route('/setmenu', function() {
    var res = this.response;
    res.end(wx.setMenu());
  }, {where: 'server'});

  Router.route('/info', function() {
    var code = this.params.query.code;
    var res = this.response;
    try {
      var userinfoData = wx.oauth(code);
      var user = Users.findOne({openid: userinfoData.openid});
      var qrcodeImg = wx.qrcode(user.uid);
      SSR.compileTemplate('info', Assets.getText('info.html'));
      Template.info.helpers({
        country: userinfoData.country,
        province: userinfoData.province,
        city: userinfoData.city,
        nickname: userinfoData.nickname,
        headimgurl: userinfoData.headimgurl,
        qrcodeurl: qrcodeImg
      });
      var html = SSR.render('info');
      res.end(html);
    } catch (err) {
      console.log('network error ' + err);
    }
  }, {where: 'server'});

  Router.route('/notify', function() {
    var code = this.params.query.code;
    var userinfoData = wx.oauth(code);
    var user = Users.findOne({openid: userinfoData.openid});
    var courselist = courseService.teacherCourse(user.uid);
    var res = this.response;
    SSR.compileTemplate('notify', Assets.getText('notify.html'));
    Template.notify.helpers({
      uid: user.uid,
      courselist: courselist
    });
    var html = SSR.render('notify');
    res.end(html);
  }, {where: 'server'});

  Router.route('/notifyAns', function() {
    var req = this.request;
    var res = this.response;
    var infoBegin = req.body.infoBegin;
    var course = req.body.course;
    var teacher = req.body.teacher;
    var infoEnd = req.body.infoEnd;
    var nowDate = new Date();
    var time = nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString();
    var openIds = [];
    var receive = req.body.receive;
    var url = '';
    // TODO receive undefined
    if (receive && receive.search(/uid_/) >= 0) {
      receive = receive.replace(/uid_/, '');
      var user = Users.findOne({uid: parseInt(receive, 10)});
      openIds = user.follower;
    } else if (receive && receive.search(/cid_/) >= 0) {
      receive = receive.replace(/cid_/, '');
      var courseinfo = courseService.courseInfo(receive);
      openIds = courseinfo.student;
      url = config.url + '/course_info/' + courseinfo._id;
    }
    for (var x in openIds) {
      if (openIds.hasOwnProperty(x)) {
        var openId = openIds[x].replace(/^\s+|\s+$/g, '');
        if (!openId) {
          continue;
        }

        var templateData = {
          'first': {
            'value': infoBegin,
            'color': '#173177'
          },
          'keyword1': {
            'value': course,
            'color': '#173177'
          },
          'keyword2': {
            'value': teacher,
            'color': '#173177'
          },
          'keyword3': {
            'value': time,
            'color': '#173177'
          },
          'remark': {
            'value': infoEnd,
            'color': '#173177'
          }
        };
        var templateResult = wx.sendTemplate(openId, config.notify_template_id, url, templateData);
        newsService.saveNews(openId, infoBegin, course, teacher, time, infoEnd);
        var infomation = templateResult.content;
        res.write(openId);
        res.write('\n');
        res.write(infomation);
        res.write('\n');
      }
    }
    res.end();
  }, {where: 'server'});

  Router.route('/news', function() {
    var code = this.params.query.code;
    var userinfoData = wx.oauth(code);
    var newslist = newsService.userNews(userinfoData.openid);
    var res = this.response;
    SSR.compileTemplate('news', Assets.getText('news.html'));
    Template.news.helpers({
      newslist: newslist.reverse()
    });
    var html = SSR.render('news');
    res.end(html);
  }, {where: 'server'});

  Router.route('/course', function() {
    var code = this.params.query.code;
    var userinfoData = wx.oauth(code);
    var courselist = courseService.studentCourse(userinfoData.openid);
    var res = this.response;
    SSR.compileTemplate('course', Assets.getText('course.html'));
    Template.course.helpers({
      courselist: courselist
    });
    var html = SSR.render('course');
    res.end(html);
  }, {where: 'server'});

  Router.route('/course_manage', function() {
    var code = this.params.query.code;
    var userinfoData = wx.oauth(code);
    var userinfo = wx.getUserInfo(userinfoData.openid);
    var courselist = courseService.teacherCourse(userinfo.uid);
    var res = this.response;
    SSR.compileTemplate('course_manage', Assets.getText('course_manage.html'));
    Template.course_manage.helpers({
      courselist: courselist,
      uid: userinfo.uid
    });
    var html = SSR.render('course_manage');
    res.end(html);
  }, {where: 'server'});

  Router.route('/course_add/:_uid', function() {
    var uid = this.params._uid;
    var res = this.response;
    SSR.compileTemplate('course_add', Assets.getText('course_add.html'));
    Template.course_add.helpers({
      uid: uid
    });
    var html = SSR.render('course_add');
    res.end(html);
  }, {where: 'server'});

  Router.route('/course_add_form', function() {
    var req = this.request;
    var uid = req.body.uid;
    var name = req.body.name;
    var info = req.body.info;
    courseService.saveCourse(parseInt(uid, 10), name, info);
    var res = this.response;
    res.end('success');
  }, {where: 'server'});

  Router.route('/chapter_add/:_cid', function() {
    var cid = this.params._cid;
    var res = this.response;
    SSR.compileTemplate('chapter_add', Assets.getText('chapter_add.html'));
    Template.chapter_add.helpers({
      cid: cid
    });
    var html = SSR.render('chapter_add');
    res.end(html);
  }, {where: 'server'});

  Router.route('/chapter_add_form', function() {
    var req = this.request;
    var cid = req.body.cid;
    var name = req.body.name;
    var info = req.body.info;
    chapterService.saveChapter(cid, name, info);

    var redirectUrl = 'http://' + config.url + '/course_info/' + cid;
    this.response.writeHead(302, {
      'Location': redirectUrl
    });
    this.response.end();
  }, {where: 'server'});

  Router.route('/course_info/:_id', function() {
    var id = this.params._id;
    var course = courseService.courseInfo(id);
    if (!course) {
      return;
    }
    var qrcodeurl = wx.qrcode(course.qrcodeid);
    var chapterList = chapterService.courseChapters(course._id);
    var res = this.response;
    SSR.compileTemplate('course_info', Assets.getText('course_info.html'));
    Template.course_info.helpers({
      cid: course._id,
      chapterList: chapterList,
      qrcodeurl: qrcodeurl
    });
    var html = SSR.render('course_info');
    res.end(html);
  }, {where: 'server'});

  Router.route('/course_info_student/:_id', function() {
    var id = this.params._id;
    var course = courseService.courseInfo(id);
    if (!course) {
      return;
    }
    var qrcodeurl = wx.qrcode(course.qrcodeid);
    var chapterList = chapterService.courseChapters(course._id);
    var res = this.response;
    SSR.compileTemplate('course_info_student', Assets.getText('course_info_student.html'));
    Template.course_info_student.helpers({
      cid: course._id,
      chapterList: chapterList,
      qrcodeurl: qrcodeurl
    });
    var html = SSR.render('course_info_student');
    res.end(html);
  }, {where: 'server'});

  Router.route('/chapter_info/:_id', function() {
    var id = this.params._id;
    var chapter = chapterService.chapterInfo(id);
    var res = this.response;
    SSR.compileTemplate('course_chapter_info', Assets.getText('course_chapter_info.html'));
    Template.course_chapter_info.helpers({
      info: marked(chapter.info)
    });
    var html = SSR.render('course_chapter_info');
    res.end(html);
  }, {where: 'server'});

  Router.route('/course_introduction/:_id', function() {
    var id = this.params._id;
    var course = courseService.courseInfo(id);
    var res = this.response;
    SSR.compileTemplate('course_chapter_info', Assets.getText('course_chapter_info.html'));
    Template.course_chapter_info.helpers({
      info: marked(course.info)
    });
    var html = SSR.render('course_chapter_info');
    res.end(html);
  }, {where: 'server'});

  Router.route('/contacts', function() {
    var res = this.response;
    var code = this.params.query.code;
    var userinfoData = wx.oauth(code);
    var followeesId = Users.find({follower: userinfoData.openid}).fetch();
    var followees = [];
    for (var x in followeesId) {
      if (followeesId.hasOwnProperty(x)) {
        followees.push(wx.getUserInfo(followeesId[x].openid));
      }
    }
    var followersId = Users.findOne({openid: userinfoData.openid});
    var followers = [];
    for (var y in followersId.follower) {
      if (followersId.follower.hasOwnProperty(y)) {
        followers.push(wx.getUserInfo(followersId.follower[y]));
      }
    }
    SSR.compileTemplate('contacts', Assets.getText('contacts.html'));
    Template.contacts.helpers({
      followees: followees,
      followers: followers
    });
    var html = SSR.render('contacts');
    res.end(html);
  }, {where: 'server'});
});
