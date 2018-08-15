export { translate, showTranslate };
/**
 * 翻译接口。
 */
const BASE_URL = "https://translate.google.cn/translate_a/single?client=gtx";

/**
 * 
 * 此函数负责将传入的文本翻译，并在当前页面的侧边栏中展示
 * 
 * @param {String} text 需要翻译的文本字符串
 * @param {Function} callback 完成翻译后用以获取翻译结果
 */
function translate(text, callback) {

    // 获取翻译语言设定。
    chrome.storage.sync.get("languageSetting", function (result) {
        var languageSetting = result.languageSetting;
        var tmpUrl = BASE_URL + "&sl=" + languageSetting.sl + "&tl=" + languageSetting.tl;

        // 获取翻译参数设定。
        chrome.storage.sync.get("DTSetting", function (result) {
            var url = tmpUrl;
            var DTSetting = result.DTSetting;
            var request = new XMLHttpRequest();

            DTSetting.forEach(element => {
                url = url + "&dt=" + element;
            });

            request.open("GET", url + "&q=" + text, true);
            request.send();
            request.onreadystatechange = function () {
                if (request.readyState === 4 && request.status === 200) {
                    callback(parseTranslate(JSON.parse(request.response)));
                }
                else if (request.status !== 200) {
                    alert('无法请求翻译，请检查网络连接');
                }
            }
        });
    });
};

/**
 * <p>解析谷歌翻译返回的结果。解析结果结构如下：</p>
 * 
 * <pre>
 *     result = {
 *         "mainMeaning": <字符串，单词的主要意思，句子的最可能的意思>,
 *         "phoneticSymbol": <字符串，单词的音标>,
 *         "originalText": <字符串，被翻译的单词或句子>,
 *         "detailedMeanings": [
 *             {
 *                 "type": <字符串，单词的词性>,
 *                 "meaning": <字符串，单词在该词性下的所有意思>
 *             }
 *         ],
 *         "commonMeanings": <字符串，单词的常见意思，句子的所有可能意思>,
 *         "synonyms": [
 *             {
 *                 "type": <字符串，单词的词性>,
 *                 "words": [
 *                     <字符串，单词在该词性下的近义词，根据意思分组>
 *                 ]
 *             }
 *         ],
 *         "definitions": [
 *             {
 *                 "type": <字符串，单词的词性>,
 *                 "meanings": [
 *                     {
 *                         "meaning": <字符串，单词的意思（英文解释）>,
 *                         "example": <字符串，例句>
 *                     }
 *                 ]
 *             }
 *         ],
 *         "examples": [
 *             <字符串，单词的例句>
 *         ],
 *         "phrases": [
 *             <字符串，单词构成的短语>
 *         ]
 *     }
 * </pre>
 * 
 * @param {Object} response 谷歌翻译返回的结果。
 * @returns {Object} 按照spec中的数据结构存储的结果
 */
function parseTranslate(response) {
    var result = new Object();
    for (var i = 0; i < response.length; i++) {
        if (response[i]) {
            var items = response[i];
            switch (i) {
                // 单词的基本意思和音标
                case 0:
                    var mainMeanings = [];
                    var originalTexts = [];
                    var lastIndex = items.length - 1;

                    for (let i = 0; i <= lastIndex; i++) {
                        mainMeanings.push(items[i][0]);
                        originalTexts.push(items[i][1]);
                    }

                    result.mainMeaning = mainMeanings.join('');
                    result.originalText = originalTexts.join('');
                    try {
                        if (lastIndex > 0 && items[lastIndex].length > 3 && items[lastIndex][3].length > 0) {
                            result.phoneticSymbol = items[lastIndex][3];
                            // console.log("phonetic symbol: " + result.phoneticSymbol);
                        }
                    } catch (error) {
                        console.log(error);
                    }
                    // console.log("text: " + result.originalText + "\nmeaning: " + result.mainMeaning);
                    break;
                // 单词的所有词性及对应的意思
                case 1:
                    result.detailedMeanings = new Array();
                    items.forEach(item =>
                        result.detailedMeanings.push({ "type": item[0], "meaning": item[1].join(", ") })
                    );
                    // console.log("detailedMeanings: " + JSON.stringify(result.detailedMeanings));
                    break;
                // 单词或句子的常见意思（单词的常见意思，句子的所有可能意思）
                case 5:
                    if (items.length <= 1) {
                        let meaningArray = new Array();
                        items[0][2].forEach(item =>
                            meaningArray.push(item[0])
                        );
                        result.commonMeanings = meaningArray.join(", ");
                        // console.log("commonMeanings: " + result.commonMeanings);
                    }
                    break;
                // 单词的同义词，根据词性分组
                case 11:
                    result.synonyms = new Array();
                    items.forEach(item => {
                        let element = new Object();
                        element.type = item[0];
                        element.words = new Array();
                        item[1].forEach(words => element.words.push(words[0].join(", ")));
                        result.synonyms.push(element);
                    });
                    // console.log("synonyms: " + JSON.stringify(result.synonyms));
                    break;
                // 单词的定义及对应例子
                case 12:
                    result.definitions = new Array();
                    items.forEach(item => {
                        let definition = new Object();
                        definition.type = item[0];
                        definition.meanings = new Array();
                        item[1].forEach(element =>
                            definition.meanings.push({ "meaning": element[0], "example": element[2] })
                        );
                        result.definitions.push(definition);
                    });
                    // console.log("definitions: " + JSON.stringify(result.definitions));
                    break;
                // 单词的例句
                case 13:
                    result.examples = new Array();
                    items.forEach(item =>
                        item.forEach(element =>
                            result.examples.push(element[0])
                        )
                    );
                    // console.log("examples: " + JSON.stringify(result.examples));
                    break;
                // 单词构成的常见短语
                case 14:
                    result.phrases = items[0];
                    // console.log("phrases: " + JSON.stringify(result.phrases));
                    break;
                default:
                    break;
            }
        }
    }
    return result;
}

/**
 * 展示翻译结果。
 * 
 * @param {Object} content 翻译结果。
 * @param {Function} callback 展示完页面后执行的回调函数
 */
function showTranslate(content, tab, callback) {
    if (content) {
        if (chrome.runtime.lastError) {
            console.log("Chrome runtime error: " + chrome.runtime.lastError.message);
            alert(content.mainMeaning);
            return;
        }
        getCurrentTabId(tab, function (tab_id) {
            if (tab_id < 0) {
                alert(content.mainMeaning);
                return;
            }
            
            if (isChrome()) { // 判断浏览器的类型 chrome的情况
                chrome.tabs.sendMessage(tab_id, content);
                // 当翻译结果展示完后，执行此回调函数
                if (callback) {
                    callback();
                }
            } else { // 是firefox的情况
                // resultPromise是返回的一个promise对象
                var resultPromise = browser.tabs.sendMessage(tab_id, content);
                resultPromise.then(function (response) { // 成功接收信息
                    // 当翻译结果展示完后，执行此回调函数
                    if (callback) {
                        callback();
                    }
                }).catch(function (error) { // 出现错误的回调
                    console.log(error);
                    alert(content.commonMeanings);
                })
            }
        });
    }
}

/**
 * 判断浏览器是否为Chrome。
 */
function isChrome() {
    return navigator.userAgent.indexOf('Chrome') >= 0;
}

function getCurrentTabId (tab, callback) {
    if (tab && tab.id >= 0) {
        callback(tab.id);
    } else if (tab) {
        let PDFFileURLRegEx = /^file:\/\/.+\.(pdf|PDF)$/;
        if (PDFFileURLRegEx.test(tab.url)) {
            chrome.extension.isAllowedFileSchemeAccess(function (isAllowedAccess) {
                if (isAllowedAccess) {
                    // 查询当前的tab，在该tab上展示结果。
                    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                        callback(tabs[0].id)
                    });
                } else {
                    // 打开管理页面，由用户开启权限
                    if (confirm(chrome.i18n.getMessage("PermissionRemind"))) {
                        let url = 'chrome://extensions/?id=' + chrome.runtime.id;
                        // 为管理页面创建一个新的标签
                        chrome.tabs.create({
                            url: url,
                            index: tab.index
                        })
                    // 用户拒绝开启，则直接展示翻译结果
                    } else {
                        console.log("Permission denied.");
                        callback(chrome.tabs.TAB_ID_NONE);
                    }
                }
            });
        } else {
            console.log("Unsupported page: " + tab.url);
            callback(chrome.tabs.TAB_ID_NONE);
        }
    } else {
        console.log("Can not get tab id.");
        callback(chrome.tabs.TAB_ID_NONE);
    }
}
