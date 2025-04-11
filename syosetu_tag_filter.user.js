// ==UserScript==
// @name         ハーメルン - タグフィルター
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  ハーメルンのランキングページでタグによるフィルタリングを可能にします
// @author       Damseleng
// @match        https://syosetu.org/?mode=rank*
// @match        https://syosetu.org/?mode=search*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const selectedTags = new Set();
    let isAndMode = true;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isSearchPage = window.location.href.includes('mode=search');
    const isSP = document.querySelector('link[href*="sp_v3.css"]') !== null;

    // タグの色情報を保持するMap
    const tagColorMap = new Map();

    // タグを含む要素を取得するセレクタ
    function getTagElements() {
        if (isSP) {
            return Array.from(document.querySelectorAll('.search_box p')).filter(p => 
                p.textContent.trim().startsWith('タグ：')
            );
        } else {
            return document.querySelectorAll('.section3 .all_keyword');
        }
    }

    // タグを正規化する関数
    function normalizeTag(tag) {
        return tag.trim()
            .replace(/[\s　]+/g, '') // 全ての空白文字（全角含む）を除去
            .replace(/\[\+\]/g, '') // [+]ボタンのテキストを除去
            .normalize('NFKC'); // 互換文字を正規化
    }

    // タグのテキストを抽出する関数
    function extractTagText(element) {
        // タグを含む要素から[+]ボタンを除いたテキストを取得
        const tagNodes = Array.from(element.childNodes).filter(node => 
            node.nodeType === Node.TEXT_NODE || // テキストノード
            (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('tag-plus-button')) // [+]ボタン以外の要素
        );
        return tagNodes.map(node => node.textContent).join('');
    }

    // タグを抽出する関数
    function extractTags(element, isNovel = false) {
        const tags = new Set();
        
        if (isSP) {
            // タグを含む段落のテキストを取得
            const alertSpan = element.querySelector('.alert_color');
            if (alertSpan) {
                // alert_colorタグを処理
                const alertText = extractTagText(alertSpan);
                alertText.split(/[\s　]+/).forEach(tag => {
                    const cleanTag = normalizeTag(tag);
                    if (cleanTag) {
                        tags.add(cleanTag);
                        if (!isNovel) tagColorMap.set(cleanTag, '#ff0000');
                    }
                });
            }

            // 通常のタグを処理（alert_color以外）
            const fullText = extractTagText(element).replace(/^タグ[：:]/u, '');
            const normalText = alertSpan ? 
                fullText.replace(extractTagText(alertSpan), '') : fullText;
            
            normalText.split(/[\s　]+/).forEach(tag => {
                const cleanTag = normalizeTag(tag);
                if (cleanTag) tags.add(cleanTag);
            });
        } else {
            // PC版の処理
            element.querySelectorAll('a').forEach(a => {
                const cleanTag = normalizeTag(a.textContent);
                if (cleanTag) {
                    tags.add(cleanTag);
                    if (!isNovel && a.classList.contains('alert_color')) {
                        tagColorMap.set(cleanTag, '#ff0000');
                    }
                }
            });
        }

        return Array.from(tags);
    }

    // タグの横に[+]ボタンを追加する関数
    function addPlusButtons() {
        getTagElements().forEach(container => {
            const tags = extractTags(container);
            
            // コンテナの内容をクリア
            if (isSP) {
                container.textContent = 'タグ：';
            } else {
                container.innerHTML = '';
            }

            // alert_colorタグと通常タグを分離
            const alertTags = tags.filter(tag => tagColorMap.has(tag));
            const normalTags = tags.filter(tag => !tagColorMap.has(tag));

            if (isSP) {
                // スマホ版の処理
                if (alertTags.length > 0) {
                    const alertSpan = document.createElement('span');
                    alertSpan.className = 'alert_color';
                    alertTags.forEach((tag, i) => {
                        if (i > 0) alertSpan.appendChild(document.createTextNode(' '));
                        
                        const tagSpan = document.createElement('span');
                        tagSpan.textContent = tag;
                        tagSpan.style.color = '#ff0000';
                        alertSpan.appendChild(tagSpan);

                        const plusButton = createPlusButton(tag);
                        alertSpan.appendChild(plusButton);
                    });
                    container.appendChild(alertSpan);
                    if (normalTags.length > 0) {
                        container.appendChild(document.createTextNode(' '));
                    }
                }
            } else {
                // PC版の処理
                alertTags.forEach((tag, i) => {
                    if (i > 0) container.appendChild(document.createTextNode(' '));
                    
                    const tagLink = document.createElement('a');
                    tagLink.href = '#';
                    tagLink.className = 'alert_color';
                    tagLink.textContent = tag;
                    container.appendChild(tagLink);

                    const plusButton = createPlusButton(tag);
                    container.appendChild(plusButton);
                });

                if (alertTags.length > 0 && normalTags.length > 0) {
                    container.appendChild(document.createTextNode(' '));
                }
            }

            // 通常タグを追加
            normalTags.forEach((tag, i) => {
                if (i > 0 || (alertTags.length > 0 && !isSP)) {
                    container.appendChild(document.createTextNode(' '));
                }

                if (!isSP) {
                    const tagLink = document.createElement('a');
                    tagLink.href = '#';
                    tagLink.textContent = tag;
                    container.appendChild(tagLink);
                } else {
                    const tagSpan = document.createElement('span');
                    tagSpan.textContent = tag;
                    container.appendChild(tagSpan);
                }

                const plusButton = createPlusButton(tag);
                container.appendChild(plusButton);
            });
        });
    }

    // [+]ボタンを作成する関数
    function createPlusButton(tag) {
        const plusButton = document.createElement('span');
        plusButton.textContent = '[+]';
        plusButton.className = 'tag-plus-button';
        plusButton.style.cssText = `
            cursor: pointer;
            color: #666;
            margin: 0 4px;
            user-select: none;
            ${isMobile ? 'padding: 5px 8px;' : ''}
        `;
        plusButton.title = 'このタグでフィルター';

        plusButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!selectedTags.has(tag)) {
                selectedTags.add(tag);
                updateSelectedTagsDisplay();
                filterNovels();
            }
        });

        return plusButton;
    }

    // タグセレクターを作成する関数
    function createTagSelector() {
        const container = document.createElement('div');
        container.id = 'tag-filter-container';
        container.style.cssText = `
            position: fixed;
            background: white;
            padding: 15px;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 9999;
            font-size: ${isMobile ? '16px' : '14px'};
            ${isMobile ? `
                bottom: 10px;
                left: 10px;
                right: 10px;
                max-height: 40vh;
            ` : `
                top: 10px;
                right: 10px;
                min-width: 220px;
            `}
        `;

        // フィルターヘッダー
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            ${isMobile ? 'padding-bottom: 10px; border-bottom: 1px solid #eee;' : ''}
        `;

        const title = document.createElement('h3');
        title.textContent = 'フィルター中のタグ';
        title.style.cssText = `
            margin: 0;
            font-size: ${isMobile ? '18px' : '16px'};
        `;
        header.appendChild(title);

        // モード切り替えボタン
        const modeButton = document.createElement('button');
        modeButton.id = 'mode-toggle-button';
        updateModeButtonText(modeButton);
        modeButton.style.cssText = `
            padding: ${isMobile ? '8px 12px' : '3px 8px'};
            border: 1px solid #ccc;
            border-radius: 3px;
            background: #f8f8f8;
            cursor: pointer;
            font-size: ${isMobile ? '16px' : '14px'};
        `;
        modeButton.addEventListener('click', () => {
            isAndMode = !isAndMode;
            updateModeButtonText(modeButton);
            filterNovels();
        });
        header.appendChild(modeButton);
        container.appendChild(header);

        // タグリスト
        const tagList = document.createElement('div');
        tagList.id = 'selected-tags-list';
        tagList.style.cssText = `
            overflow-y: auto;
            padding-right: 5px;
            ${isMobile ? 'max-height: calc(40vh - 120px);' : 'max-height: 60vh;'}
        `;
        container.appendChild(tagList);

        // すべてクリアボタン
        const clearButton = document.createElement('button');
        clearButton.textContent = 'すべてクリア';
        clearButton.style.cssText = `
            margin-top: 10px;
            padding: ${isMobile ? '10px' : '5px 10px'};
            border: 1px solid #ccc;
            border-radius: 3px;
            background: #f8f8f8;
            cursor: pointer;
            width: 100%;
            font-size: ${isMobile ? '16px' : '14px'};
        `;
        clearButton.addEventListener('click', () => {
            selectedTags.clear();
            updateSelectedTagsDisplay();
            filterNovels();
        });
        container.appendChild(clearButton);

        return container;
    }

    // モードボタンのテキストを更新
    function updateModeButtonText(button) {
        button.textContent = isAndMode ? 'AND' : 'OR';
        button.title = isAndMode ? 
            'すべてのタグを含む小説を表示（タップでORモードに切替）' : 
            'いずれかのタグを含む小説を表示（タップでANDモードに切替）';
    }

    // 選択タグの表示を更新
    function updateSelectedTagsDisplay() {
        const tagList = document.getElementById('selected-tags-list');
        if (!tagList) return;

        tagList.innerHTML = '';

        if (selectedTags.size === 0) {
            const message = document.createElement('div');
            message.style.cssText = `
                color: #666;
                padding: ${isMobile ? '10px 0' : '5px 0'};
            `;
            message.textContent = 'タグが選択されていません';
            tagList.appendChild(message);
            return;
        }

        Array.from(selectedTags).sort().forEach(tag => {
            const tagDiv = document.createElement('div');
            tagDiv.style.cssText = `
                margin: 5px 0;
                padding: ${isMobile ? '10px' : '5px'};
                background: #f8f8f8;
                border-radius: 3px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;

            const tagText = document.createElement('span');
            tagText.textContent = tag;
            if (tagColorMap.has(tag)) {
                tagText.style.color = tagColorMap.get(tag);
            }
            tagText.style.marginRight = '10px';

            const removeButton = document.createElement('span');
            removeButton.textContent = '×';
            removeButton.style.cssText = `
                cursor: pointer;
                color: #666;
                padding: ${isMobile ? '5px 12px' : '0 5px'};
                font-size: ${isMobile ? '20px' : '14px'};
            `;
            removeButton.addEventListener('click', () => {
                selectedTags.delete(tag);
                updateSelectedTagsDisplay();
                filterNovels();
            });

            tagDiv.appendChild(tagText);
            tagDiv.appendChild(removeButton);
            tagList.appendChild(tagDiv);
        });
    }

    function filterNovels() {
        const selector = isSP ? '.search_box' : '.section3';
        document.querySelectorAll(selector).forEach(novel => {
            const tagContainer = isSP ?
                Array.from(novel.querySelectorAll('p')).find(p =>
                    p.textContent.trim().startsWith('タグ：')
                ) :
                novel.querySelector('.all_keyword');

            if (!tagContainer) {
                novel.style.display = selectedTags.size === 0 ? '' : 'none';
                return;
            }

            // タグを抽出して正規化
            const novelTags = extractTags(tagContainer, true).map(tag => normalizeTag(tag));
            const normalizedSelectedTags = Array.from(selectedTags).map(tag => normalizeTag(tag));

            // デバッグログ
            console.log('Novel Tags (Normalized):', novelTags);
            console.log('Selected Tags (Normalized):', normalizedSelectedTags);

            if (selectedTags.size === 0) {
                novel.style.display = '';
            } else if (isAndMode) {
                const hasAllTags = normalizedSelectedTags.every(selectedTag => {
                    const hasTag = novelTags.some(novelTag => novelTag === selectedTag);
                    console.log(`Checking tag "${selectedTag}":`, hasTag);
                    return hasTag;
                });
                novel.style.display = hasAllTags ? '' : 'none';
                console.log('AND Mode - Display:', novel.style.display);
            } else {
                const hasAnyTag = normalizedSelectedTags.some(selectedTag => {
                    const hasTag = novelTags.some(novelTag => novelTag === selectedTag);
                    console.log(`Checking tag "${selectedTag}":`, hasTag);
                    return hasTag;
                });
                novel.style.display = hasAnyTag ? '' : 'none';
                console.log('OR Mode - Display:', novel.style.display);
            }
        });
    }

    // メイン処理
    function init() {
        const waitForContent = () => {
            const contentSelector = isSP ? '.search_box' : '.section3';
            if (!document.querySelector(contentSelector)) {
                setTimeout(waitForContent, 500);
                return;
            }

            const tagSelector = createTagSelector();
            document.body.appendChild(tagSelector);
            addPlusButtons();
            updateSelectedTagsDisplay();
        };

        waitForContent();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
