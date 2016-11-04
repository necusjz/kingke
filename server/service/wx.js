import { HTTP } from 'meteor/http';
var config = require('../config.js');
var collection = require('../models/collection.js');
var Wx = collection.Wx;
var QrCode = collection.QrCode;
var check = [];

/**
 * Get WeiXin Access Token from mongo cache or API.
 * @returns {String} Access Token
 */
var getAccessToken = function() {
  var accessTokenCache = Wx.findOne({ name: 'access_token' });

  if (accessTokenCache && accessTokenCache.time > Date.now()) {
    return accessTokenCache.value;
  }

  var tokenUrl = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + config.appID + '&secret=' + config.appsecret;

  var tokenResult = HTTP.get(tokenUrl);
  var accessToken = tokenResult.data.access_token;

  // check is access token is right.
  if (!accessToken) {
    console.log("[[appID or appsecret ERROR, check your config.js]]");
    console.log("--- error message begin ----");
    console.log(tokenResult.data);
    console.log("--- error message end ----");
    return "";
  }

  if (accessTokenCache) {
    Wx.update(accessTokenCache._id, {
      $set: {
        value: accessToken,
        time: Date.now() + 6000 * 1000
      }
    });
  } else {
    accessTokenCache = {};
    accessTokenCache.value = accessToken;
    accessTokenCache.name = 'access_token';
    accessTokenCache.time = Date.now() + 6000 * 1000;
    Wx.insert(accessTokenCache);
  }
  return accessToken;
};

/**
 * Send Template Message.
 * @param  {String} openid WeiXin User OpenId
 * @param  {String} templateId template's' id in config.js
 * @param  {String} url click url
 * @param  {Object} data template info data
 * @returns {Response} the result of HTTP.post
 */
exports.sendTemplate = function(openid, templateId, url, data) {
  var accessToken = getAccessToken();
  var templateUrl = 'https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=' + accessToken;
  var templateData = {
    touser: openid,
    template_id: templateId,
    url: url,
    data: data
  };
  var templateJson = JSON.stringify(templateData);
  return HTTP.post(templateUrl, { content: templateJson });
};

/**
 * use oauth get user info
 * @param  {String} code weixin oauth2 code
 * @returns {Object} userinfoData
 */
exports.oauth = function(code) {
  var oauth2Url = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + config.appID + '&secret=' + config.appsecret + '&code=' + code + '&grant_type=authorization_code';
  var oauth2Result = HTTP.get(oauth2Url);
  var oauth2Data = JSON.parse(oauth2Result.content);
  var openid = oauth2Data.openid;
  var accessToken = oauth2Data.access_token;

  var userinfoUrl = 'https://api.weixin.qq.com/sns/userinfo?lang=zh_CN&access_token=' + accessToken + '&openid=' + openid;
  var userinfoResult = HTTP.get(userinfoUrl);
  var userinfoData = JSON.parse(userinfoResult.content);
  return userinfoData;
};

/**
 * create QrCode by weixin API.
 * @param {int} id QrCode id
 * @returns {String} QrCode picture url
 */
exports.qrcode = function(id) {
  var qrcodeCache = QrCode.findOne({ qid: id });
  if (qrcodeCache && qrcodeCache.time > Date.now()) {
    return qrcodeCache.url;
  }
  var accessToken = getAccessToken();
  var qrcodeUrl = 'https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=' + accessToken;
  var qrcodeData = {
    'expire_seconds': 604800,
    'action_name': 'QR_SCENE',
    'action_info': {
      'scene': {
        'scene_id': id
      }
    }
  };
  qrcodeData = JSON.stringify(qrcodeData);
  var qrcodeResult = HTTP.post(qrcodeUrl, { content: qrcodeData });
  var qrcodeJson = JSON.parse(qrcodeResult.content);
  var qrcodeImg = 'https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=' + encodeURIComponent(qrcodeJson.ticket);
  if (qrcodeCache) {
    QrCode.update(qrcodeCache._id, {
      $set: {
        url: qrcodeImg,
        time: Date.now() + 600000 * 1000
      }
    });
  } else {
    qrcodeCache = {};
    qrcodeCache.qid = id;
    qrcodeCache.url = qrcodeImg;
    qrcodeCache.time = Date.now() + 600000 * 1000;
    QrCode.insert(qrcodeCache);
  }
  return qrcodeImg;
};

/**
 * Use open id get User info. First get from database, then use weixin API.
 * @param {String} openid weixin open id
 * @returns {Object} User info
 */
exports.getUserInfo = function(openid) {
  var accessToken = getAccessToken();
  var userinfoUrl = 'https://api.weixin.qq.com/cgi-bin/user/info?access_token=' + accessToken + '&openid=' + openid + '&lang=zh_CN';
  var userinfoResult = HTTP.get(userinfoUrl);
  var userinfoData = JSON.parse(userinfoResult.content);
  return userinfoData;
};

/**
 * set weixin menu.
 * @returns {String} the result of HTTP.post
 */
exports.setMenu = function() {
  try {
    var accessToken = getAccessToken();
    var menuUrl = 'https://api.weixin.qq.com/cgi-bin/menu/create?access_token=' + accessToken;
    var oauth2UrlBegin = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + config.appID + '&response_type=code&scope=snsapi_userinfo&state=lc&redirect_uri=';
    var oauth2UrlEnd = '#wechat_redirect';
    var menuData = {
      'button': [
        {
          'type': 'view',
          'name': '动态',
          'url': 'http://' + config.url + '/chat'
        },
        {
          'type': 'view',
          'name': '课程',
          'url': oauth2UrlBegin + encodeURIComponent('http://' + config.url + '/course') + oauth2UrlEnd
        },
        {
          'name': '更多',
          'sub_button': [
            {
              'type': 'view',
              'name': '课程管理',
              'url': oauth2UrlBegin + encodeURIComponent('http://' + config.url + '/course_manage') + oauth2UrlEnd
            },
            {
              'type': 'view',
              'name': '联系人',
              'url': oauth2UrlBegin + encodeURIComponent('http://' + config.url + '/contacts') + oauth2UrlEnd
            },
            {
              'type': 'view',
              'name': '发通知',
              'url': oauth2UrlBegin + encodeURIComponent('http://' + config.url + '/notify') + oauth2UrlEnd
            },
            {
              'type': 'view',
              'name': '我的名片',
              'url': oauth2UrlBegin + encodeURIComponent('http://' + config.url + '/info') + oauth2UrlEnd
            }]
        }]
    };
    var menuJson = JSON.stringify(menuData);
    var menuResult = HTTP.post(menuUrl, { content: menuJson });
    return '[[set menu result]]\n' + menuResult.content;
  } catch (err) {
    return '[[set menu result ERROR]]\n' + err;
  }
};

/**
 * check weixin token.
 * @param  {String} nonce number from weixin
 * @param  {String} timestamp timestamp from weixin
 * @param  {String} signature signature from weixin
 * @param  {String} echostr String from weixin
 * @returns {String} success:echostr fail:false
 */
exports.checkToken = function(nonce, timestamp, signature, echostr) {
  var l = [];
  l[0] = nonce;
  l[1] = timestamp;
  l[2] = config.token;
  l.sort();
  var original = l.join('');
  var sha = CryptoJS.SHA1(original).toString();
  if (signature === sha) {
    return echostr;
  }
  return 'false';
};

/**
 * 默认空函数.
 * @param  {Object} xml 推送XML数据包
 * @returns {void}
 */
var noop = function(xml) {
  if (xml.MsgType[0] === 'event') {
    console.log("[[[ " + xml.Event[0] + " is not implement]]]");
  } else {
    console.log("[[[ " + xml.MsgType[0] + " is not implement]]]");
  }
};

/**
 * receive message callback.
 * @param  {Object} xml 推送XML数据包
 * @param  {function} text=noop 文本消息
 * @param  {function} image=noop 图片消息
 * @param  {function} voice=noop 语音消息
 * @param  {function} video=noop 视频消息
 * @param  {function} shortvideo=noop 小视频消息
 * @param  {function} location=noop 地理位置消息
 * @param  {function} link=noop 链接消息
 * @param  {function} subscribe=noop 关注事件
 * @param  {function} unsubscribe=noop 取消关注事件
 * @param  {function} qrcode=noop 扫描带参数二维码事件
 * @param  {function} eventLocation=noop 上报地理位置事件
 * @param  {function} click=noop 自定义菜单事件-点击菜单拉取消息时的事件推送
 * @param  {function} view=noop 自定义菜单事件-点击菜单跳转链接时的事件推送
 * @returns {void}
 */
exports.receiveMessage = function(
  xml,
  text = noop,
  image = noop,
  voice = noop,
  video = noop,
  shortvideo = noop,
  location = noop,
  link = noop,
  subscribe = noop,
  unsubscribe = noop,
  qrcode = noop,
  eventLocation = noop,
  click = noop,
  view = noop) {
  if (!xml) {
    return;
  }
  // 重试的消息排重
  var repeat = xml.FromUserName.join('') + xml.CreateTime.join('');
  var isFirstCall = true;
  for (var x in check) {
    if (check[x] === repeat) {
      isFirstCall = false;
      break;
    }
  }
  if (isFirstCall) {
    check.push(repeat);
  } else {
    return;
  }

  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	text
  // Content	文本消息内容
  // MsgId	消息id，64位整型
  if (xml.MsgType[0] === 'text') {
    (typeof text === 'function') ? text(xml) : noop(xml);
  //
  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	image
  // PicUrl	图片链接
  // MediaId	图片消息媒体id，可以调用多媒体文件下载接口拉取数据。
  // MsgId	消息id，64位整型
  } else if (xml.MsgType[0] === 'image') {
    (typeof image === 'function') ? image(xml) : noop(xml);
  //
  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	语音为voice
  // MediaId	语音消息媒体id，可以调用多媒体文件下载接口拉取数据。
  // Format	语音格式，如amr，speex等
  // MsgID	消息id，64位整型
  } else if (xml.MsgType[0] === 'voice') {
    (typeof voice === 'function') ? voice(xml) : noop(xml);
  //
  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	视频为video
  // MediaId	视频消息媒体id，可以调用多媒体文件下载接口拉取数据。
  // ThumbMediaId	视频消息缩略图的媒体id，可以调用多媒体文件下载接口拉取数据。
  // MsgId	消息id，64位整型
  } else if (xml.MsgType[0] === 'video') {
    (typeof video === 'function') ? video(xml) : noop(xml);
  //
  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	小视频为shortvideo
  // MediaId	视频消息媒体id，可以调用多媒体文件下载接口拉取数据。
  // ThumbMediaId	视频消息缩略图的媒体id，可以调用多媒体文件下载接口拉取数据。
  // MsgId	消息id，64位整型
  } else if (xml.MsgType[0] === 'shortvideo') {
    (typeof shortvideo === 'function') ? shortvideo(xml) : noop(xml);
  //
  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	location
  // Location_X	地理位置维度
  // Location_Y	地理位置经度
  // Scale	地图缩放大小
  // Label	地理位置信息
  // MsgId	消息id，64位整型
  } else if (xml.MsgType[0] === 'location') {
    (typeof location === 'function') ? location(xml) : noop(xml);
  //
  // ToUserName	接收方微信号
  // FromUserName	发送方微信号，若为普通用户，则是一个OpenID
  // CreateTime	消息创建时间
  // MsgType	消息类型，link
  // Title	消息标题
  // Description	消息描述
  // Url	消息链接
  // MsgId	消息id，64位整型
  } else if (xml.MsgType[0] === 'link') {
    (typeof link === 'function') ? link(xml) : noop(xml);
  } else if (xml.MsgType[0] === 'event') {
    //
    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，subscribe(订阅)、unsubscribe(取消订阅)
    if (xml.Event[0] === 'subscribe') {
      (typeof subscribe === 'function') ? subscribe(xml) : noop(xml);
      //
      // ToUserName	开发者微信号
      // FromUserName	发送方帐号（一个OpenID）
      // CreateTime	消息创建时间 （整型）
      // MsgType	消息类型，event
      // Event	事件类型，subscribe
      // EventKey	事件KEY值，qrscene_为前缀，后面为二维码的参数值
      // Ticket	二维码的ticket，可用来换取二维码图片
      if (xml.EventKey) {
        (typeof qrcode === 'function') ? qrcode(xml) : noop(xml);
      }
    //
    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，subscribe(订阅)、unsubscribe(取消订阅)
    } else if (xml.Event[0] === 'unsubscribe') {
      (typeof unsubscribe === 'function') ? unsubscribe(xml) : noop(xml);
    //
    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，SCAN
    // EventKey	事件KEY值，是一个32位无符号整数，即创建二维码时的二维码scene_id
    // Ticket	二维码的ticket，可用来换取二维码图片
    } else if (xml.Event[0] === 'SCAN') {
      (typeof qrcode === 'function') ? qrcode(xml) : noop(xml);
    //
    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，LOCATION
    // Latitude	地理位置纬度
    // Longitude	地理位置经度
    // Precision	地理位置精度
    } else if (xml.Event[0] === 'LOCATION') {
      (typeof eventLocation === 'function') ? eventLocation(xml) : noop(xml);
    //
    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，CLICK
    // EventKey	事件KEY值，与自定义菜单接口中KEY值对应
    } else if (xml.Event[0] === 'CLICK') {
      (typeof click === 'function') ? click(xml) : noop(xml);
    //
    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，VIEW
    // EventKey	事件KEY值，设置的跳转URL
    } else if (xml.Event[0] === 'VIEW') {
      (typeof view === 'function') ? view(xml) : noop(xml);
    }
  }
  return;
};
