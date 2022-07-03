// ==UserScript==
// @name     NicoVideoCustomFilter
// @include  https://sp.nicovideo.jp/*
// @version  1
// @grant    none
// ==/UserScript==

// セッションストレージのキー
const SESSION_STORAGE_KEY = {
    REMOVE_VIDEO_ID_LIST: "nvcf_remove_video_list",
    BLOCK_USER_ID_LIST: "nvcf_block_user_list"
}

// ブロックユーザ指定用のマイリストの名前
const BLOCK_USER_MY_LIST_TITLE = "BlockUsers";

// ユーザ一人につきブロックする動画の上限数
const NUMBER_OF_VIDEOS_TO_BLOCK_PER_USER = 50;

// 非表示処理の実行頻度（ミリ秒）
const INTERVAL_MILLI_SECOUND = 2000;

// 非表示処理実行の上限時間（ミリ秒）
const TIMEOUT_MILLI_SECOUND = 60 * 60 * 1000;

// apiにリクエストを送信
async function SendGetRequest(requestUrl)
{
    try {
        const response = await fetch(requestUrl, {
            method: "GET",
            mode: 'cors',
            credentials: "include",
            headers: {
              'Content-Type': 'application/json;charset=utf-8',
              'Cookie': document.cookie,
              'X-Frontend-Id': 1
            }
        });
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error('NicoVideoCustomFilter: APIからのデータ取得に失敗');
        }
    }
    catch (error) {
        console.error(error);
    }
}

// ユーザの投稿した動画IDのリストを取得
async function GetUserVideos(userId, limit)
{
    // リクエストURLを作成
    const requestUrl = "https://nvapi.nicovideo.jp/v3/users/" + userId + "/videos?sortKey=registeredAt&sortOrder=desc&pageSize=" + limit + "&page=1";
    // APIにリクエストを送信し、データ（json）を取得
    const responseJson = await SendGetRequest(requestUrl);
    // 受け取ったデータを動画IDのリストに変換
    const videoIdList = responseJson.data.items.map(item => item.essential.id);

    return videoIdList;
}

// マイリスト内の動画の投稿者を取得
async function GetUserListFromMyList(myListTitle)
{
    // BLOCK_USER_MY_LIST_TITLEと名前が一致するマイリストのIDを取得
    const blockUserMyListId = (await SendGetRequest("https://nvapi.nicovideo.jp/v1/users/me/mylists"))
        .data.mylists.find(e => e.name == BLOCK_USER_MY_LIST_TITLE).id;
    // マイリストがない場合は終了
    if (blockUserMyListId === undefined) return;

    // リクエストURLを作成
    const requestUrl = "https://nvapi.nicovideo.jp/v1/users/me/mylists/" + blockUserMyListId + "?sortKey=addedAt&sortOrder=asc&pageSize=100&page=1";
    // APIにリクエストを送信し、データ（json）を取得
    const responseJson = await SendGetRequest(requestUrl);

    // ユーザIDのリストに変換し、重複を解消 
    // Tips: Array.fron(new Set())で重複を解消できる
    const userIdList = Array.from(new Set(
        responseJson.data.mylist.items.map(e => e.video.owner.id)
    ));
    return userIdList;
}

// 非表示対象のユーザのリストを取得
async function GetRemoveTargetUserList()
{
    // セッションストレージに既にある場合はその値を返して終了
    if (sessionStorage.getItem(SESSION_STORAGE_KEY.BLOCK_USER_ID_LIST))
    {
        return sessionStorage.getItem(SESSION_STORAGE_KEY.BLOCK_USER_ID_LIST).split(",");
    }

    // ブロックユーザ設定用のマイリストからユーザ一覧を取得
    const blockUserIdList = await GetUserListFromMyList(BLOCK_USER_MY_LIST_TITLE);

    // セッションストレージに格納
    sessionStorage.setItem(SESSION_STORAGE_KEY.BLOCK_USER_ID_LIST, blockUserIdList.toString());

    // 値を返して終了
    return blockUserIdList;
}

// ユーザIDのリストから動画のリストを取得
async function GetVideoIdListByUserIdList(userIdList)
{
    // 全てのユーザの動画IDのリスト
    const allVideoIdList = [];
    for(let userId of userIdList)
    {
        // そのユーザの投稿した動画の一覧をIDで取得
        const videoIdList = await GetUserVideos(userId, NUMBER_OF_VIDEOS_TO_BLOCK_PER_USER);
        // allVideoIdListに追加
        Array.prototype.push.apply(allVideoIdList, videoIdList);
    }
    return allVideoIdList;
}

// 非表示にする動画IDの一覧を取得する
async function GetRemoveVideoIdList()
{
    // セッションストレージに既にある場合はその値を返して終了
    if (sessionStorage.getItem(SESSION_STORAGE_KEY.REMOVE_VIDEO_ID_LIST))
    {
        return sessionStorage.getItem(SESSION_STORAGE_KEY.REMOVE_VIDEO_ID_LIST).split(",");
    }
    
    // 非表示対象のユーザのリストを取得
    const targetUserIdList = await GetRemoveTargetUserList();

    // 対象ユーザの投稿動画一覧を取得
    const removeVideoIdList = await GetVideoIdListByUserIdList(targetUserIdList);

    // セッションストレージに格納
    sessionStorage.setItem(SESSION_STORAGE_KEY.REMOVE_VIDEO_ID_LIST, removeVideoIdList.toString());
    // 値を返して終了
    return removeVideoIdList;
}

// 動画IDが一致する動画の要素を非表示にする
function RemoveVideoElement(videoIdList)
{
    // 要素取得のためのクエリ文字列を作成
    const queryString = videoIdList.map(videoId => "[href*='" + videoId + "']").toString();

    // 要素を全て取得
    const elementList = document.querySelectorAll(queryString);

    // 取得した要素を非表示
    elementList.forEach(element => element.style = "display:none");
}

// メイン関数
async function Main()
{
    // 対象の動画Idのリストを取得
    const removeVideoIdList = await GetRemoveVideoIdList();

    // 動画IDが一致する要素を非表示にする処理を繰り返し実行
    const intervalId = setInterval(() => {RemoveVideoElement(removeVideoIdList)}, INTERVAL_MILLI_SECOUND);

    // 一定時間経ったら停止
    setTimeout(() => {clearInterval(intervalId)}, TIMEOUT_MILLI_SECOUND);
}

Main.call();
