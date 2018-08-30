/**
 * xmt 程序入口
 *
 * */
// const electron = require('electron');
//electron.app, electron.BrowserWindow, electron.ipcMain; //require('electron');
const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const url = require('url');
const moment = require('moment');
const config = require('./shared/config').config;
const log4js = require('log4js');


log4js.configure({
    appenders: {
        console: {type: 'console'},
        xmt: {
            type: 'file',
            filename: path.join(app.getPath('appData'), 'xmt', 'logs', 'main.' + moment(new Date()).format('YYYY-MM-DD') + '.log')
        }
    },
    categories: {
        default: {
            appenders: ['console', 'xmt'],
            level: 'debug'
        }
    }
});

const logger = log4js.getLogger('xmt');
logger.info('xmt start version is ' + config.app.version);

let viewerWindow;

let viewerWindowWidth = 1210;
let viewerWindowHeight = 700;


/////////////////////////////////////////////////旧版本命令行运行会报错但用js调用可以，如想使用命令行可以去GitHub下载官方demo//////////////////////////////////////////////////////
var params = '';
logger.info("Platform is " + process.platform);
logger.info("Process argv:", process.argv);
var args = process.argv;
var splits = [];
if (args && args.length < 2) {
    logger.info("Exit: system params error!")
    app.quit();
}else {
    try{
        logger.info("args:", args);
        splits = args[1].split("://");
        params = splits[1].replace(/\+/g, "&");
        logger.debug('params: ', params);
    }catch (err) {
        logger.error(err);
        app.quit();
    }
}
if (process.platform === 'win32') {
    viewerWindowWidth = 1220;
}

// params = 'https://xmt.1000best.cn/webLive/OneToOne/teacher.html?roomid='+args.roomId+'&userid='+args.userId+'&role='+args.role+'&itemId='+args.itemId+'';
// params='https://xmt.1000best.cn/webLive/OneToOne/teacher.html?roomid=8199CE680B7378529C33DC5901307461&userid=F956185775069813&role=presenter&itemId=346';
/////////////////////////////////////////////////旧版本//////////////////////////////////////////////////////


logger.debug("params info :", params);

function createViewerWindow() {

    viewerWindow = new BrowserWindow({
        width: viewerWindowWidth,
        height: viewerWindowHeight,
        minWidth: viewerWindowWidth,
        minHeight: viewerWindowHeight,
        nodeIntegration: true,
        autoHideMenuBar: true,
        backgroundColor: '#FFF',
        title: 'V' + config.app.version + ' 新铭堂',
        icon: path.join(__dirname, 'favicon.ico'),
        webPreferences: {}
    });
    // viewerWindow.openDevTools();
    viewerWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'renderer', 'index.html'),
        protocol: 'file:',
        slashes: true
    }));
    logger.info('params:', params);
    viewerWindow.webContents.on('did-finish-load', function () {

        //if (params && params.indexOf('roomid') >= 0 && params.indexOf('userid') >= 0 && params.indexOf('role') >=0) {
        var room = url.parse(params, true).query;
        logger.debug("params parse to room:", room);
        var s='';
        if(room.type=='ot'){
            s = 'https://xmt.1000best.cn/webLive/OneToOne/teacher.html?token='+room.token+'&roomid=' + room.roomid + '&userid=' + room.userid + '&sessionid=' + room.sessionid + '&itemId=' +room.itemId;
        }else if(room.type=='mt'){
            s = 'https://xmt.1000best.cn/webLive/OneToMore/teacher.html?token='+room.token+'&roomid=' + room.roomid + '&userid=' + room.userid + '&sessionid=' + room.sessionid + '&itemId=' +room.itemId;
        }else if(room.type=='os'){
            s = 'https://xmt.1000best.cn/webLive/OneToOne/student.html?token='+room.token+'&roomid=' + room.roomid + '&userid=' + room.userid + '&sessionid=' + room.sessionid + '&itemId=' +room.itemId;
        }else if(room.type=='ms'){
            s = 'https://xmt.1000best.cn/webLive/OneToMore/student.html?token='+room.token+'&roomid=' + room.roomid + '&userid=' + room.userid + '&sessionid=' + room.sessionid + '&itemId=' +room.itemId;
        }
        console.log(s);
        logger.info('webview load url ' + s);

        sendMsgToRenderer(SIGNAL_CORPS_ACTION.CHANGE_WEBVIEW_SRC, s);
        //} else {
        //    sendMsgToRenderer(SIGNAL_CORPS_ACTION.ERROR_PARAMS);
        //}
    });
    
    viewerWindow.on('closed', function () {
        viewerWindow = null;
    });
}

app.on('ready', createViewerWindow);

app.on('window-all-closed', function () {
    if (app) {
        app.quit();
    }
});

/**
 * 隐藏默认菜单栏
 * */
app.on('browser-window-created', function (e, window) {
    window.setMenu(null);
});


var shouldQuit = app.makeSingleInstance(function (commandLine, workingDirectory) {
    // 当另一个实例运行的时候，这里将会被调用，我们需要激活应用的窗口
    if (viewerWindow) {
        if (viewerWindow.isMinimized()) {
            viewerWindow.restore();
        }
        viewerWindow.focus();
    }
    return true;
});

// 这个实例是多余的实例，需要退出
if (shouldQuit) {
    app.quit();
    return;
}

app.on('activate', function () {
    logger.debug('app activate');

    if (viewerWindow === null) {
        createViewerWindow()
    }
});

const CHANNEL_SIGNAL_CORPS = 'signal_corps';
const SIGNAL_CORPS_ACTION = {
    CHANGE_WEBVIEW_SRC: 'change_webview_src',
    LOCK_SCREEN: 'lock_screen',
    UNLOCK_SCREEN: 'unlock_screen',
    ERROR_PARAMS: 'error_params',
    QUIT_APP: 'quit_app',
    OPEN_DEV_TOOLS: 'open_dev_tools',
    DEBUG_LOG: 'debug_log'
};

function sendMsgToRenderer(action, data) {
    viewerWindow.webContents.send(CHANNEL_SIGNAL_CORPS, {
        action: action,
        data: data
    });
}


let isLockScreen = false;
ipcMain.on(CHANNEL_SIGNAL_CORPS, (event, datas) => {
    var action = datas.action;

    if (action === SIGNAL_CORPS_ACTION.LOCK_SCREEN) {
        isLockScreen = true;
        if (viewerWindow) {
            if (viewerWindow.isMinimized()) {
                viewerWindow.restore();
            }

            if (!viewerWindow.isFocused()) {
                viewerWindow.focus();
            }

            viewerWindow.setAlwaysOnTop(true);
            viewerWindow.setFullScreen(true);
        }
    } else if (action === SIGNAL_CORPS_ACTION.UNLOCK_SCREEN) {
        isLockScreen = false;
        if (viewerWindow) {
            viewerWindow.setAlwaysOnTop(false);
            viewerWindow.setFullScreen(false);
        }
    } else if (action === SIGNAL_CORPS_ACTION.QUIT_APP) {
        if (app) {
            app.quit();
        }
    } else if (action === SIGNAL_CORPS_ACTION.OPEN_DEV_TOOLS) {
        // viewerWindow.openDevTools();
    }
});


setInterval(function () {
    if (!viewerWindow) {
        return;
    }
    viewerWindow.setAlwaysOnTop(isLockScreen);
}, 10000);


function debugLog(msg) {
    sendMsgToRenderer(SIGNAL_CORPS_ACTION.DEBUG_LOG, msg);
}
