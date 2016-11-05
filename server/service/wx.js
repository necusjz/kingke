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
    console.log("[[[ event " + xml.Event[0] + " is not implement]]]");
  } else {
    console.log("[[[ message " + xml.MsgType[0] + " is not implement]]]");
  }
};

/**
 * receive message callback.
 * @param  {Object} xml 推送XML数据包
 * @param  {Object} callback callbackList
 *   callbackList = {
 *     text = noop,                   普通消息-文本消息
 *     image = noop,                  普通消息-图片消息
 *     voice = noop,                  普通消息-语音消息
 *     video = noop,                  普通消息-视频消息
 *     shortvideo = noop,             普通消息-小视频消息
 *     location = noop,               普通消息-地理位置消息
 *     link = noop,                   普通消息-链接消息
 *     subscribe = noop,              事件推送-关注事件
 *     unsubscribe = noop,            事件推送-取消关注事件
 *     qrcode = noop,                 事件推送-扫描带参数二维码事件
 *     templatesendjobfinish = noop,  模版消息事件-送达事件
 *     eventLocation = noop,          自定义菜单事件-上报地理位置事件
 *     click = noop,                  自定义菜单事件-点击菜单拉取消息时的事件推送
 *     view = noop,                   自定义菜单事件-点击菜单跳转链接时的事件推送
 *     scancode_push = noop,          自定义菜单事件-扫码推事件的事件推送
 *     scancode_waitmsg = noop,       自定义菜单事件-扫码推事件且弹出“消息接收中”提示框的事件推送
 *     pic_sysphoto = noop,           自定义菜单事件-弹出系统拍照发图的事件推送
 *     pic_photo_or_album = noop,     自定义菜单事件-弹出拍照或者相册发图的事件推送
 *     pic_weixin = noop,             自定义菜单事件-弹出微信相册发图器的事件推送
 *     location_select = noop         自定义菜单事件-弹出地理位置选择器的事件推送
 *   }
 * @returns {void}
 */
exports.receiveMessage = function(xml, callback) {
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

  // [[[接收普通消息]]]

  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	text
  // Content	文本消息内容
  // MsgId	消息id，64位整型
  if (xml.MsgType[0] === 'text') {
    (typeof callback.text === 'function') ? callback.text(xml) : noop(xml);

  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	image
  // PicUrl	图片链接
  // MediaId	图片消息媒体id，可以调用多媒体文件下载接口拉取数据。
  // MsgId	消息id，64位整型
  } else if (xml.MsgType[0] === 'image') {
    (typeof callback.image === 'function') ? callback.image(xml) : noop(xml);

  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	语音为voice
  // MediaId	语音消息媒体id，可以调用多媒体文件下载接口拉取数据。
  // Format	语音格式，如amr，speex等
  // MsgID	消息id，64位整型
  } else if (xml.MsgType[0] === 'voice') {
    (typeof callback.voice === 'function') ? callback.voice(xml) : noop(xml);

  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	视频为video
  // MediaId	视频消息媒体id，可以调用多媒体文件下载接口拉取数据。
  // ThumbMediaId	视频消息缩略图的媒体id，可以调用多媒体文件下载接口拉取数据。
  // MsgId	消息id，64位整型
  } else if (xml.MsgType[0] === 'video') {
    (typeof callback.video === 'function') ? callback.video(xml) : noop(xml);

  // ToUserName	开发者微信号
  // FromUserName	发送方帐号（一个OpenID）
  // CreateTime	消息创建时间 （整型）
  // MsgType	小视频为shortvideo
  // MediaId	视频消息媒体id，可以调用多媒体文件下载接口拉取数据。
  // ThumbMediaId	视频消息缩略图的媒体id，可以调用多媒体文件下载接口拉取数据。
  // MsgId	消息id，64位整型
  } else if (xml.MsgType[0] === 'shortvideo') {
    (typeof callback.shortvideo === 'function') ? callback.shortvideo(xml) : noop(xml);

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
    (typeof callback.location === 'function') ? callback.location(xml) : noop(xml);

  // ToUserName	接收方微信号
  // FromUserName	发送方微信号，若为普通用户，则是一个OpenID
  // CreateTime	消息创建时间
  // MsgType	消息类型，link
  // Title	消息标题
  // Description	消息描述
  // Url	消息链接
  // MsgId	消息id，64位整型
  } else if (xml.MsgType[0] === 'link') {
    (typeof callback.link === 'function') ? callback.link(xml) : noop(xml);

  // [[[接收事件推送]]]
  } else if (xml.MsgType[0] === 'event') {
    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，subscribe(订阅)、unsubscribe(取消订阅)
    if (xml.Event[0] === 'subscribe') {
      (typeof callback.subscribe === 'function') ? callback.subscribe(xml) : noop(xml);

      // ToUserName	开发者微信号
      // FromUserName	发送方帐号（一个OpenID）
      // CreateTime	消息创建时间 （整型）
      // MsgType	消息类型，event
      // Event	事件类型，subscribe
      // EventKey	事件KEY值，qrscene_为前缀，后面为二维码的参数值
      // Ticket	二维码的ticket，可用来换取二维码图片
      if (xml.EventKey) {
        (typeof callback.qrcode === 'function') ? callback.qrcode(xml) : noop(xml);
      }

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，subscribe(订阅)、unsubscribe(取消订阅)
    } else if (xml.Event[0] === 'unsubscribe') {
      (typeof callback.unsubscribe === 'function') ? callback.unsubscribe(xml) : noop(xml);

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，SCAN
    // EventKey	事件KEY值，是一个32位无符号整数，即创建二维码时的二维码scene_id
    // Ticket	二维码的ticket，可用来换取二维码图片
    } else if (xml.Event[0] === 'SCAN') {
      (typeof callback.qrcode === 'function') ? callback.qrcode(xml) : noop(xml);

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，LOCATION
    // Latitude	地理位置纬度
    // Longitude	地理位置经度
    // Precision	地理位置精度
    } else if (xml.Event[0] === 'LOCATION') {
      (typeof callback.eventLocation === 'function') ? callback.eventLocation(xml) : noop(xml);

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，CLICK
    // EventKey	事件KEY值，与自定义菜单接口中KEY值对应
    } else if (xml.Event[0] === 'CLICK') {
      (typeof callback.click === 'function') ? callback.click(xml) : noop(xml);

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，VIEW
    // EventKey	事件KEY值，设置的跳转URL
    } else if (xml.Event[0] === 'VIEW') {
      (typeof callback.view === 'function') ? callback.view(xml) : noop(xml);

    // ToUserName	公众号微信号
    // FromUserName	接收模板消息的用户的openid
    // CreateTime	创建时间
    // MsgType	消息类型是事件
    // Event	事件为模板消息发送结束
    // MsgID	消息id
    // Status	发送状态 [success] [failed:user block] [failed: system failed]
    } else if (xml.Event[0] === 'TEMPLATESENDJOBFINISH') {
      (typeof callback.templatesendjobfinish === 'function') ? callback.templatesendjobfinish(xml) : noop(xml);

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间（整型）
    // MsgType	消息类型，event
    // Event	事件类型，scancode_push
    // EventKey	事件KEY值，由开发者在创建菜单时设定
    // ScanCodeInfo	扫描信息
    // ScanType	扫描类型，一般是qrcode
    // ScanResult	扫描结果，即二维码对应的字符串信息
    } else if (xml.Event[0] === 'scancode_push') {
      (typeof callback.scancode_push === 'function') ? callback.scancode_push(xml) : noop(xml);

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，scancode_waitmsg
    // EventKey	事件KEY值，由开发者在创建菜单时设定
    // ScanCodeInfo	扫描信息
    // ScanType	扫描类型，一般是qrcode
    // ScanResult	扫描结果，即二维码对应的字符串信息
    } else if (xml.Event[0] === 'scancode_waitmsg') {
      (typeof callback.scancode_waitmsg === 'function') ? callback.scancode_waitmsg(xml) : noop(xml);

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，pic_sysphoto
    // EventKey	事件KEY值，由开发者在创建菜单时设定
    // SendPicsInfo	发送的图片信息
    // Count	发送的图片数量
    // PicList	图片列表
    // PicMd5Sum	图片的MD5值，开发者若需要，可用于验证接收到图片
    } else if (xml.Event[0] === 'pic_sysphoto') {
      (typeof callback.pic_sysphoto === 'function') ? callback.pic_sysphoto(xml) : noop(xml);

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，pic_photo_or_album
    // EventKey	事件KEY值，由开发者在创建菜单时设定
    // SendPicsInfo	发送的图片信息
    // Count	发送的图片数量
    // PicList	图片列表
    // PicMd5Sum	图片的MD5值，开发者若需要，可用于验证接收到图片
    } else if (xml.Event[0] === 'pic_photo_or_album') {
      (typeof callback.pic_photo_or_album === 'function') ? callback.pic_photo_or_album(xml) : noop(xml);

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，pic_weixin
    // EventKey	事件KEY值，由开发者在创建菜单时设定
    // SendPicsInfo	发送的图片信息
    // Count	发送的图片数量
    // PicList	图片列表
    // PicMd5Sum	图片的MD5值，开发者若需要，可用于验证接收到图片
    } else if (xml.Event[0] === 'pic_weixin') {
      (typeof callback.pic_weixin === 'function') ? callback.pic_weixin(xml) : noop(xml);

    // ToUserName	开发者微信号
    // FromUserName	发送方帐号（一个OpenID）
    // CreateTime	消息创建时间 （整型）
    // MsgType	消息类型，event
    // Event	事件类型，location_select
    // EventKey	事件KEY值，由开发者在创建菜单时设定
    // SendLocationInfo	发送的位置信息
    // Location_X	X坐标信息
    // Location_Y	Y坐标信息
    // Scale	精度，可理解为精度或者比例尺、越精细的话 scale越高
    // Label	地理位置的字符串信息
    // Poiname	朋友圈POI的名字，可能为空
    } else if (xml.Event[0] === 'location_select') {
      (typeof callback.location_select === 'function') ? callback.location_select(xml) : noop(xml);
    }
  }
  return;
};
