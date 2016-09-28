import { Meteor } from 'meteor/meteor';
import { HTTP } from 'meteor/http';
var config = require("./config.js")
var Users = new Mongo.Collection('Users');
var Ids = new Mongo.Collection('Ids');
var Wx = new Mongo.Collection('Wx');
var QrCode = new Mongo.Collection('QrCode');
var check = [];

Meteor.startup(() => {
  // code to run on server at startup

  function wxGetAccessToken() {
    var access_token_cache = Wx.findOne({name:'access_token'});
    if (access_token_cache && access_token_cache.time > Date.now()) {
      return access_token_cache.value;
    } else {
      var token_url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + config.appID + "&secret=" + config.appsecret;
      var token_result = HTTP.get(token_url);
      var access_token = token_result.data.access_token;
      var template_url = "https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=" + access_token;
      access_token_cache = {};
      access_token_cache.value = access_token;
      access_token_cache.name = 'access_token';
      access_token_cache.time = Date.now() + 6000 * 1000;
      Wx.insert(access_token_cache);
      return access_token;
    }
  }

  function wxSendTemplate(openid, template_id, url, data) {
    var access_token = wxGetAccessToken();
    var template_url = "https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=" + access_token;
    var template_data = {
      touser: openid,
      template_id: template_id,
      url: url,
      data: data
    }
    var template_json = JSON.stringify(template_data);
    return HTTP.post(template_url, {content: template_json});
  }

  function wxOauth(code) {
    var oauth2_url = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + config.appID + '&secret=' + config.appsecret + '&code=' + code + '&grant_type=authorization_code';
    var oauth2_result = HTTP.get(oauth2_url);
    var oauth2_data = JSON.parse(oauth2_result.content);
    var openid = oauth2_data.openid;
    var access_token = oauth2_data.access_token;
    
    var userinfo_url = "https://api.weixin.qq.com/sns/userinfo?access_token=" + access_token + "&openid=" + openid;
    var userinfo_result = HTTP.get(userinfo_url);
    var userinfo_data = JSON.parse(userinfo_result.content);
    return userinfo_data;
  }

  function wxQrcode(id) {
    var qrcode_cache = QrCode.findOne({qid:id});
    if (qrcode_cache && qrcode_cache.time > Date.now()) {
      return qrcode_cache.url;
    } else {
      var access_token = wxGetAccessToken();
      var qrcode_url = "https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=" + access_token;
      var qrcode_data = {
        "expire_seconds": 604800, 
        "action_name": "QR_SCENE", 
        "action_info": {
          "scene": {
            "scene_id": id
          }
        }
      };
      qrcode_data = JSON.stringify(qrcode_data);
      var qrcode_result = HTTP.post(qrcode_url,{content: qrcode_data});
      var qrcode_json = JSON.parse(qrcode_result.content);
      var qrcode_img = "https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=" + encodeURIComponent(qrcode_json.ticket);
      qrcode_cache = {};
      qrcode_cache.qid = id;
      qrcode_cache.url = qrcode_img;
      qrcode_cache.time = Date.now() + 600000 * 1000;
      QrCode.insert(qrcode_cache);
      return qrcode_cache.url;
    }
  }

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
            Users.insert(user);
          }
        }
        if (result.xml.EventKey && (result.xml.Event == "subscribe" || result.xml.Event == "SCAN")) {
          var followid = result.xml.EventKey.join('');
          var teacher = Users.findOne({uid:parseInt(followid)});
          var student = Users.findOne({openid:result.xml.FromUserName[0]});
          
          var template_data = {
            text: {
              value: "你已被关注" + student.openid,
              color: "#173177"
            }
          };
          wxSendTemplate(teacher.openid, config.follow_template_id, null, template_data);
          var template_data = {
            text: {
              value: "你已关注" + teacher.openid,
              color: "#173177"
            }
          };
          wxSendTemplate(student.openid, config.follow_template_id, null, template_data);
        }
      }
      this.response.end("");
    });

  Router.route('/setmenu', function () {
    var res = this.response;
    try {
      var access_token = wxGetAccessToken();
      var menu_url = "https://api.weixin.qq.com/cgi-bin/menu/create?access_token=" + access_token;
      var oauth2_url = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=" + config.appID + "&response_type=code&scope=snsapi_userinfo&state=lc#wechat_redirect&redirect_uri=";
      var menu_data = {
        "button": [
          {
            "type": "view",
            "name": "动态",
            "url": oauch2_url + encodeURIComponent(config.url + "/news")
          },
          {
            "type": "view",
            "name": "课程",
            "url": oauch2_url + encodeURIComponent(config.url + "/course")
          },
          {
            "name": "更多",
            "sub_button": [
              {
                "type": "view",
                "name": "课程管理",
                "url": oauch2_url + encodeURIComponent(config.url + "/course_manage")
              },
              {
                "type": "view",
                "name": "联系人",
                "url": oauch2_url + encodeURIComponent(config.url + "/contacts")
              },
              {
                "type": "view",
                "name": "发通知",
                "url": "http://" + config.url + "/notify"
              },
              {
                "type": "view",
                "name": "我的名片",
                "url": oauch2_url + encodeURIComponent(config.url + "/info")
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
    var req = this.request;
    var code = this.params.query.code;
    var res = this.response;
    try {
      var userinfo_data = wxOauth(code);
      var user = Users.findOne({openid:userinfo_data.openid});
      var qrcode_img = wxQrcode(user.uid);
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

  Router.route("/notifyAns", function () {
    var req = this.request;
    var res = this.response;
    var openIds = req.body.openIds;
    var infoBegin = req.body.infoBegin;
    var course = req.body.course;
    var teacher = req.body.teacher;
    var infoEnd = req.body.infoEnd;
    var openIds = openIds.split("\n");
    var nowDate = new Date();
    var time = nowDate.toLocaleDateString() + " "+ nowDate.toLocaleTimeString();
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
      var template_result = wxSendTemplate(openId, config.notify_template_id, null, template_data);
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
    var res = this.response;
    SSR.compileTemplate('course_manage', Assets.getText('course_manage.html'));
    Template.course_manage.helpers({
      
    });
    var html = SSR.render("course_manage");
    res.end(html);
  },{where: 'server'});

  Router.route('/contacts', function () {
    var res = this.response;
    SSR.compileTemplate('contacts', Assets.getText('contacts.html'));
    Template.news.helpers({
      
    });
    var html = SSR.render("contacts");
    res.end(html);
  },{where: 'server'});
  
});
