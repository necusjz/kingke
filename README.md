# kingke

基于[微信服务号API](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1445241432&token=&lang=zh_CN)和[Meteor](https://www.meteor.com/)开发课程管理SaaS平台kingke

## Requirements

* 用户作为管理者可以创建和编辑活动（markdown格式）,创建活动时生成一个活动二维码（微信服务号带参数的二维码）
* 用户通过扫描管理者分享的活动二维码加入该活动，用户可以查看自己的活动列表及活动详情
* 管理者可以给某个活动的所有参与者发文字通知（微信服务号模板消息）
* 用户可以收到活动通知
* 用户可以查看和编辑个人名片，个人名片中包含个人临时二维码（微信服务号带参数的二维码）
* 扫描用户个人二维码关注该用户，用户可以查看关注者列表

## QuickStart

* 下载、安装、运行
```
//安装meteor,如果已经安装过了请忽略
curl https://install.meteor.com/ | sh
//下载kingke代码
git clone https://git.coding.net/mengning/kingke.git
//运行kingke
cd kingke
sudo meteor --port 80
```
* 申请[微信公众平台测试号](http://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login)
  * 接口配置url类似http://your.domain.name/weixin
  * 接口配置token自己定义,与项目配置文件server/config.js填写一致即可
  * 体验接口权限表-网页服务-网页帐号-网页授权获取用户基本信息-修改，只填写域名，比如your.domain.name
  * 创建消息模板，模板参见[INSTALL.md](https://coding.net/u/mengning/p/kingke/git/blob/master/INSTALL.md)
* 修改配置文件server/config.js
```
//Warning!!!
//Do Not Commit this file!!!
exports.token = "YOUR_TOKEN"; //自己定义,与申请测试号时填写一致即可
exports.appID = "YOUR_APPID"; 
exports.appsecret = "YOUR_APPSECRET";
exports.url = "YOUR_DOMAIN_NAME" //只填写域名，比如your.domain.name
exports.notify_templet_id = "YOUR_TEMPLET_ID"; //你的通知模板ID
exports.follow_template_id = "YOUR_TEMPLET_ID"; //你的关注消息模板ID
```
* 启动meteor即会自动设置菜单
* 更多安装部署指南参考[INSTALL.md](https://coding.net/u/mengning/p/kingke/git/blob/master/INSTALL.md)


## Links

* [微信UI设计规范](https://mp.weixin.qq.com/debug/wxadoc/design/?t=1475052563066&from=groupmessage&isappinstalled=0#wechat_redirect) - https://weui.io
* [快速搭建基于meteor的微信公众号开发环境](https://coding.net/u/mengning/p/kingke/git/tree/v0.0.1)
* [NodeJS官网](https://nodejs.org/en/)
* [Meteor官网](https://www.meteor.com/) - [meteor学习笔记](http://www.itjiaoshou.com/meteor-study.html)
* [React官网](https://facebook.github.io/react/index.html) - [一看就懂的ReactJs入门教程（精华版）](http://www.cocoachina.com/webapp/20150721/12692.html)
