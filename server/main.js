import { Meteor } from 'meteor/meteor';
import { HTTP } from 'meteor/http';
var config = require("./config.js")
var Users = new Mongo.Collection('Users');
var Ids = new Mongo.Collection('Ids');

Meteor.startup(() => {
  // code to run on server at startup

  if (Meteor.isServer) {
    Router.configureBodyParsers = function () {
      Router.onBeforeAction( Iron.Router.bodyParser.json(), {except: ['creditReferral'], where: 'server'});
      //Enable incoming XML requests for creditReferral route
      Router.onBeforeAction(
        Iron.Router.bodyParser.raw({
          type: '*/*', 
          only: ['creditReferral'],
          verify: function(req, res, body) { 
            req.rawBody = body.toString(); 
          }, 
          where: 'server'
        })
      );
      Router.onBeforeAction( Iron.Router.bodyParser.urlencoded({ extended: false }), {where: 'server'});
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
      if (result.xml && result.xml.Event == "subscribe") {
        var message = {};
        message.xml = {};
        message.xml.ToUserName = result.xml.FromUserName;
        message.xml.FromUserName = result.xml.ToUserName;
        message.xml.CreateTime = result.xml.CreateTime;
        message.xml.MsgType = "text";
        message.xml.Content = "感谢您的关注";
        var builder = new xml2js.Builder();

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

        this.response.end(builder.buildObject(message));
      } else {
        this.response.end("");
      }
    });

  Router.route('/setmenu', function () {
    var res = this.response;
    try {
      var token_url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + config.appID + "&secret=" + config.appsecret;
      var token_result = HTTP.get(token_url);
      var access_token = token_result.data.access_token;
      var menu_url = "https://api.weixin.qq.com/cgi-bin/menu/create?access_token=" + access_token;
      var menu_data = '{"button":[{"type":"view","name":"动态","url":"https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + config.appID + '&redirect_uri=http%3A%2F%2F' + config.url + '%2Fnews&response_type=code&scope=snsapi_userinfo&state=lc#wechat_redirect"},{ "type":"view","name":"课程","url":"https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + config.appID + '&redirect_uri=http%3A%2F%2F' + config.url + '%2Fcourse&response_type=code&scope=snsapi_userinfo&state=lc#wechat_redirect"},{"name":"更多","sub_button":[{"type":"view","name":"课程管理","url":"https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + config.appID + '&redirect_uri=http%3A%2F%2F' + config.url + '%2Fcourse_manage&response_type=code&scope=snsapi_userinfo&state=lc#wechat_redirect"},{"type":"view","name":"联系人","url":"https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + config.appID + '&redirect_uri=http%3A%2F%2F' + config.url + '%2Fcontacts&response_type=code&scope=snsapi_userinfo&state=lc#wechat_redirect"},{"type":"view","name":"发通知","url":"http://' + config.url +'/notify"},{"type":"view","name":"我的名片","url":"https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + config.appID + '&redirect_uri=http%3A%2F%2F' + config.url + '%2Finfo&response_type=code&scope=snsapi_userinfo&state=lc#wechat_redirect"}]}]}';
      var menu_result = HTTP.post(menu_url,{content: menu_data});
      res.end("set success" + menu_result.content);
    } catch (err) {
      res.end("network error " + err);
    }
  }, {where: 'server'});
  

  Router.route('/info', function () {
    var req = this.request;
    var code = this.params.query.code;
    var res = this.response;
    try {
      var oauth2_url = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + config.appID + '&secret=' + config.appsecret + '&code=' + code + '&grant_type=authorization_code';
      var oauth2_result = HTTP.get(oauth2_url);
      var oauth2_data = JSON.parse(oauth2_result.content);
      var openid = oauth2_data.openid;
      var access_token = oauth2_data.access_token;
      
      var userinfo_url = "https://api.weixin.qq.com/sns/userinfo?access_token=" + access_token + "&openid=" + openid;
      var userinfo_result = HTTP.get(userinfo_url);
      var userinfo_data = JSON.parse(userinfo_result.content);

      var token_url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + config.appID + "&secret=" + config.appsecret;
      var token_result = HTTP.get(token_url);
      access_token = token_result.data.access_token;
      user = Users.findOne({openid:openid});
      var qrcode_url = "https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=" + access_token;
      var qrcode_data = '{"expire_seconds": 604800, "action_name": "QR_SCENE", "action_info": {"scene": {"scene_id": ' + user.uid + '}}}';
      var qrcode_result = HTTP.post(qrcode_url,{content: qrcode_data});
      var qrcode_json = JSON.parse(qrcode_result);
      var qrcode_img = "https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=" + encodeURIComponent(qrcode_json.ticket);
      
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

      var res = this.response;
      var token_url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + config.appID + "&secret=" + config.appsecret;
      var token_result = HTTP.get(token_url);
      var access_token = token_result.data.access_token;
      var templet_url = "https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=" + access_token;
      var templet_data = '{"touser":"' + openId + '","template_id":"' + config.notify_templet_id + '","url":"","data":{"first": {"value":"' + infoBegin + '","color":"#173177"},"keyword1":{"value":"' + course + '","color":"#173177"},"keyword2": {"value":"'+teacher+'","color":"#173177"},"keyword3": {"value":"'+time+'","color":"#173177"},"remark":{"value":"'+infoEnd+'","color":"#173177"}}}';
      var templet_result = HTTP.post(templet_url, {content: templet_data});
      infomation = templet_result.content;
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
