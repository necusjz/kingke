import { Meteor } from 'meteor/meteor';
import { HTTP } from 'meteor/http';
var config = require("./config.js");
var collection = require("./collection.js");
var Users = collection.Users;
var Courses = collection.Courses;
var Ids = collection.Ids;
var wx = require("./wx.js");
var courseService = require("./course.js");
var chapterService = require("./chapter.js");
var marked = require('marked');
var check = [];

Meteor.startup(() => {

  if (Meteor.isServer) {
    Router.configureBodyParsers = function () {
      Router.onBeforeAction(Iron.Router.bodyParser.json());
      Router.onBeforeAction(Iron.Router.bodyParser.urlencoded({extended: false}));
      //Enable incoming XML requests for creditReferral route
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
  }

  Router.route('/weixin', {where: 'server'},)
    .get(function () {
      var req = this.request;
      var res = this.response;
      var signature = this.params.query.signature;
      var timestamp = this.params.query.timestamp;
      var nonce = this.params.query.nonce;
      var echostr = this.params.query.echostr;
      var l = new Array();
      l[0] = nonce;
      l[1] = timestamp;
      l[2] = config.token;
      l.sort();
      var original = l.join('');
      var sha = CryptoJS.SHA1(original).toString();
      if (signature == sha) {
        res.end(echostr);
      } else {
        res.end("false");
      }
    })
    .post(function () {
      var result = xml2js.parseStringSync(this.request.rawBody);
      var repeat = result.xml.FromUserName.join("") + result.xml.CreateTime.join("");
      var dothing = true;
      for (x in check) {
        if (check[x] == repeat) {
          dothing = false;
          break;
        }
      }
      if (result.xml && dothing) {
        check.push(repeat);
        if (result.xml.Event == "subscribe") {
          var message = {};
          message.xml = {};
          message.xml.ToUserName = result.xml.FromUserName;
          message.xml.FromUserName = result.xml.ToUserName;
          message.xml.CreateTime = result.xml.CreateTime;
          message.xml.MsgType = "text";
          message.xml.Content = "感谢您的关注";

          if (!Ids.findOne({name:"user"})) {
            Ids.insert({name:"user", id:0});
          }

          if (!Users.findOne({openid:result.xml.FromUserName[0]})) {
            var user = {};
            id = Ids.findOne({"name":"user"});
            user.uid = id.id + 1;
            Ids.update({"name":"user"}, {$inc:{id: 1}});
            user.openid = result.xml.FromUserName[0];
            //TODO user null
            //TODO refactor user model
            Users.insert(user);
          }
        }
        if (result.xml.EventKey && result.xml.EventKey.join('') && (result.xml.Event == "subscribe" || result.xml.Event == "SCAN")) {
          var qrcodeid = result.xml.EventKey.join('');
          qrcodeid = qrcodeid.replace(/qrscene_/,"");
          qrcodeid = parseInt(qrcodeid);
          if (qrcodeid < 1000000) {
            var followid = qrcodeid;
            var teacher = Users.findOne({uid:followid});
            teacher = wx.GetUserInfo(teacher.openid);
            var student = wx.GetUserInfo(result.xml.FromUserName[0]);
            
            var template_data = {
              text: {
                value: "你已关注 " + teacher.nickname,
                color: "#173177"
              }
            };
            wx.SendTemplate(student.openid, config.follow_template_id, null, template_data);

            if (!Users.findOne({openid:teacher.openid, follower:student.openid})) {
              var template_data = {
                text: {
                  value: "你已被 " + student.nickname + " 关注",
                  color: "#173177"
                }
              };
              wx.SendTemplate(teacher.openid, config.follow_template_id, null, template_data);
              Users.update({openid:teacher.openid}, {$push: {follower: student.openid}});
            }
          } else {
            var course = Courses.findOne({qrcodeid:qrcodeid});
            
            var template_data = {
              text: {
                value: "你已加入《" + course.name + "》",
                color: "#173177"
              }
            };
            var student = wx.GetUserInfo(result.xml.FromUserName[0]);
            wx.SendTemplate(
              student.openid, 
              config.follow_template_id, 
              config.url + "/course_info/" + course._id, 
              template_data);

            if (!Courses.findOne({_id:course._id, student: student.openid})) {
              Courses.update({_id:course._id}, {$push: {student: student.openid}});
            }
          }
        }
      }
      this.response.end("");
    });

  Router.route('/setmenu', function () {
    var res = this.response;
    try {
      var access_token = wx.GetAccessToken();
      var menu_url = "https://api.weixin.qq.com/cgi-bin/menu/create?access_token=" + access_token;
      var oauth2_url = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=" + config.appID + "&response_type=code&scope=snsapi_userinfo&state=lc&redirect_uri=";
      var oauth2_url_end = "#wechat_redirect"
      var menu_data = {
        "button": [
          {
            "type": "view",
            "name": "动态",
            "url": oauth2_url + encodeURIComponent("http://" + config.url + "/news") + oauth2_url_end
          },
          {
            "type": "view",
            "name": "课程",
            "url": oauth2_url + encodeURIComponent("http://" + config.url + "/course") + oauth2_url_end
          },
          {
            "name": "更多",
            "sub_button": [
              {
                "type": "view",
                "name": "课程管理",
                "url": oauth2_url + encodeURIComponent("http://" + config.url + "/course_manage") + oauth2_url_end
              },
              {
                "type": "view",
                "name": "联系人",
                "url": oauth2_url + encodeURIComponent("http://" + config.url + "/contacts") + oauth2_url_end
              },
              {
                "type": "view",
                "name": "发通知",
                "url": oauth2_url + encodeURIComponent("http://" + config.url + "/notify") + oauth2_url_end
              },
              {
                "type": "view",
                "name": "我的名片",
                "url": oauth2_url + encodeURIComponent("http://" + config.url + "/info") + oauth2_url_end
              }]
          }]
      };
      var menu_json = JSON.stringify(menu_data);
      var menu_result = HTTP.post(menu_url,{content: menu_json});
      res.write(menu_json);
      res.end("set result " + menu_result.content);
    } catch (err) {
      res.end("network error " + err);
    }
  }, {where: 'server'});
  

  Router.route('/info', function () {
    var code = this.params.query.code;
    var res = this.response;
    try {
      var userinfo_data = wx.Oauth(code);
      var user = Users.findOne({openid:userinfo_data.openid});
      var qrcode_img = wx.Qrcode(user.uid);
      SSR.compileTemplate('info', Assets.getText('info.html'));
      Template.info.helpers({
        country: userinfo_data.country,
        province: userinfo_data.province,
        city: userinfo_data.city,
        nickname: userinfo_data.nickname,
        headimgurl: userinfo_data.headimgurl,
        qrcodeurl: qrcode_img
      });
      var html = SSR.render("info");
      res.end(html);
    } catch (err) {
      console.log("network error " + err);
    }
  }, {where: 'server'});

  Router.route('/notify', function () {
    var code = this.params.query.code;
    var userinfo_data = wx.Oauth(code);
    var user = Users.findOne({openid:userinfo_data.openid});
    var res = this.response;
    SSR.compileTemplate('notify', Assets.getText('notify.html'));
    Template.notify.helpers({
      uid: "uid_" + user.uid
    });
    var html = SSR.render("notify");
    res.end(html);
  }, {where: 'server'});

  Router.route("/notifyAns", function () {
    var req = this.request;
    var res = this.response;
    var infoBegin = req.body.infoBegin;
    var course = req.body.course;
    var teacher = req.body.teacher;
    var infoEnd = req.body.infoEnd;
    var nowDate = new Date();
    var time = nowDate.toLocaleDateString() + " "+ nowDate.toLocaleTimeString();
    var openIds = [];
    var receive = req.body.receive;
    //TODO receive undefined
    if (receive.search(/uid_/) >= 0) {
      receive = receive.replace(/uid_/, '');
      user = Users.findOne({uid:parseInt(receive)});
      openIds = user.follower;
    } else if (receive.search(/cid_/) >= 0) {
      //TODO add class notify
    }
    for (x in openIds) {
      var openId = openIds[x].replace(/^\s+|\s+$/g,"");
      if (openId == "") {
        continue;
      }

      var template_data = {
        "first": {
          "value": infoBegin,
          "color": "#173177"
        },
        "keyword1": {
          "value": course,
          "color": "#173177"
        }, 
        "keyword2": { 
          "value": teacher, 
          "color": "#173177" 
        }, 
        "keyword3": { 
          "value": time, 
          "color": "#173177" 
        }, 
        "remark": { 
          "value": infoEnd, 
          "color": "#173177" 
        }
      };
      var template_result = wx.SendTemplate(openId, config.notify_template_id, null, template_data);
      infomation = template_result.content;
      res.write(openId);
      res.write("\n")
      res.write(infomation);
      res.write("\n")
    }
    res.end();
  }, {where: 'server'});

  Router.route('/news', function () {
    var res = this.response;
    SSR.compileTemplate('news', Assets.getText('news.html'));
    Template.news.helpers({
      
    });
    var html = SSR.render("news");
    res.end(html);
  },{where: 'server'});

  Router.route('/course', function () {
    var res = this.response;
    SSR.compileTemplate('course', Assets.getText('course.html'));
    Template.course.helpers({
      
    });
    var html = SSR.render("course");
    res.end(html);
  },{where: 'server'});

  Router.route('/course_manage', function () {
    var code = this.params.query.code;
    var userinfo_data = wx.Oauth(code);
    var userinfo = wx.GetUserInfo(userinfo_data.openid);
    var courselist = courseService.teacherCourse(userinfo.uid);
    var res = this.response;
    SSR.compileTemplate('course_manage', Assets.getText('course_manage.html'));
    Template.course_manage.helpers({
      courselist: courselist,
      uid: userinfo.uid
    });
    var html = SSR.render("course_manage");
    res.end(html);
  },{where: 'server'});

  Router.route('/course_add/:_uid', function () {
    var uid = this.params._uid;
    var res = this.response;
    SSR.compileTemplate('course_add', Assets.getText('course_add.html'));
    Template.course_add.helpers({
      uid: uid
    });
    var html = SSR.render("course_add");
    res.end(html);
  },{where: 'server'});

  Router.route('/course_add_form', function () {
    var req = this.request;
    var uid = req.body.uid;
    var name = req.body.name;
    var info = req.body.info;
    courseService.saveCourse(parseInt(uid), name, info);
    var res = this.response;
    res.end("success");
  },{where: 'server'});

  Router.route('/chapter_add/:_cid', function () {
    var cid = this.params._cid;
    var res = this.response;
    SSR.compileTemplate('chapter_add', Assets.getText('chapter_add.html'));
    Template.chapter_add.helpers({
      cid: cid
    });
    var html = SSR.render("chapter_add");
    res.end(html);
  },{where: 'server'});

  Router.route('/chapter_add_form', function () {
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
  },{where: 'server'});

  Router.route('/course_info/:_id', function () {
    var id = this.params._id;
    var course = courseService.courseInfo(id);
    if (!course) {
      return;
    }
    var qrcodeurl = wx.Qrcode(course.qrcodeid);
    var chapterList = chapterService.courseChapters(course._id);
    var res = this.response;
    SSR.compileTemplate('course_info', Assets.getText('course_info.html'));
    Template.course_info.helpers({
      cid: course._id,
      chapterList: chapterList,
      qrcodeurl: qrcodeurl
    });
    var html = SSR.render("course_info");
    res.end(html);
  },{where: 'server'});

  Router.route('/chapter_info/:_id', function () {
    var id = this.params._id;
    var chapter = chapterService.chapterInfo(id);
    var res = this.response;
    SSR.compileTemplate('course_chapter_info', Assets.getText('course_chapter_info.html'));
    Template.course_chapter_info.helpers({
      info: marked(chapter.info)
    });
    var html = SSR.render("course_chapter_info");
    res.end(html);
  },{where: 'server'});

  Router.route('/course_introduction/:_id', function () {
    var id = this.params._id;
    var course = courseService.courseInfo(id);
    var res = this.response;
    SSR.compileTemplate('course_chapter_info', Assets.getText('course_chapter_info.html'));
    Template.course_chapter_info.helpers({
      info: marked(course.info)
    });
    var html = SSR.render("course_chapter_info");
    res.end(html);
  },{where: 'server'});

  Router.route('/contacts', function () {
    var res = this.response;
    var code = this.params.query.code;
    var userinfo_data = wx.Oauth(code);
    var followees_id = Users.find({follower: userinfo_data.openid}).fetch();
    var followees = new Array();
    for (x in followees_id) {
      followees.push(wx.GetUserInfo(followees_id[x].openid));
    }
    var followers_id = Users.findOne({openid: userinfo_data.openid});
    var followers = new Array();
    for (x in followers_id.follower) {
      followers.push(wx.GetUserInfo(followers_id.follower[x]));
    }
    SSR.compileTemplate('contacts', Assets.getText('contacts.html'));
    Template.contacts.helpers({
      followees: followees,
      followers: followers
    });
    var html = SSR.render("contacts");
    res.end(html);
  },{where: 'server'});
  
});
