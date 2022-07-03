// ==UserScript==
// @name     HideNicoVideoAppAds
// @include  https://sp.nicovideo.jp/*
// @version  1
// @grant    none
// ==/UserScript==

document.querySelectorAll("#jsSmartAppBanner").forEach(element => element.style = "display: none");
