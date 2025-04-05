// ==UserScript==
// @name         ハーメルン - タグフィルター
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  ハーメルンのランキングページでタグによるフィルタリングを可能にします
// @author       Damseleng
// @match        https://syosetu.org/?mode=rank*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 選択されているタグを保持するSet
    const selectedTags = new Set();
    // フィルターモード（true: AND, false: OR）
    let isAndMode = true;

    // タグの横に[+]ボタンを追加する関数
    function addPlusButtons() {
        document.querySelectorAll('.section3 .all_keyword a').forEach(tagLink => {
            // 既に[+]ボタンが追加されている場合はスキップ
            if (tagLink.nextSibling && tagLink.nextSibling.classList && tagLink.nextSibling.classList.contains('tag-plus-button')) {
                return;
            }

            const plusButton = document.createElement('span');
            plusButton.textContent = '[+]';
            plusButton.className = 'tag-plus-button';
            plusButton.style.cssText = `
                cursor: pointer;
                color: #666;
                margin: 0 4px;
                user-select: none;
            `;
            plusButton.title = 'このタグでフィルター';

            // クリックイベントの追加
            plusButton.addEventListener('click', (e) => {
                e.preventDefault();
                const tagText = tagLink.textContent.trim();
                if (!selectedTags.has(tagText)) {
                    selectedTags.add(tagText);
                    updateSelectedTagsDisplay();
                    filterNovels();
                }
            });

            // タグリンクの後に[+]ボタンを挿入
            tagLink.insertAdjacentElement('afterend', plusButton);
        });
    }

    // 選択されているタグの表示を作成する関数
    function createTagSelector() {
        const container = document.createElement('div');
        container.id = 'tag-filter-container';
        container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: white;
            padding: 15px;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 9999;
            font-size: 14px;
            min-width: 220px;
        `;

        const title = document.createElement('h3');
        title.textContent = 'フィルター中のタグ';
        title.style.marginTop = '0';
        title.style.marginBottom = '10px';
        container.appendChild(title);

        // フィルターモード切り替えボタン
        const modeToggle = document.createElement('div');
        modeToggle.style.cssText = `
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
        `;

        const modeLabel = document.createElement('span');
        modeLabel.textContent = 'フィルターモード：';
        modeToggle.appendChild(modeLabel);

        const modeButton = document.createElement('button');
        modeButton.id = 'mode-toggle-button';
        updateModeButtonText(modeButton);
        modeButton.style.cssText = `
            padding: 3px 8px;
            border: 1px solid #ccc;
            border-radius: 3px;
            background: #f8f8f8;
            cursor: pointer;
        `;
        modeButton.addEventListener('click', () => {
            isAndMode = !isAndMode;
            updateModeButtonText(modeButton);
            filterNovels();
        });
        modeToggle.appendChild(modeButton);
        container.appendChild(modeToggle);

        // 選択タグを表示する領域
        const tagList = document.createElement('div');
        tagList.id = 'selected-tags-list';
        tagList.style.cssText = `
            max-height: 60vh;
            overflow-y: auto;
            padding-right: 5px;
        `;
        container.appendChild(tagList);

        // すべてクリアするボタン
        const clearButton = document.createElement('button');
        clearButton.textContent = 'すべてクリア';
        clearButton.style.cssText = `
            margin-top: 10px;
            padding: 5px 10px;
            border: 1px solid #ccc;
            border-radius: 3px;
            background: #f8f8f8;
            cursor: pointer;
            width: 100%;
        `;
        clearButton.addEventListener('click', () => {
            selectedTags.clear();
            updateSelectedTagsDisplay();
            filterNovels();
        });
        container.appendChild(clearButton);

        return container;
    }

    // モードボタンのテキストを更新する関数
    function updateModeButtonText(button) {
        button.textContent = isAndMode ? 'AND' : 'OR';
        button.title = isAndMode ? 
            'すべてのタグを含む小説を表示（クリックでORモードに切替）' : 
            'いずれかのタグを含む小説を表示（クリックでANDモードに切替）';
    }

    // 選択されているタグの表示を更新する関数
    function updateSelectedTagsDisplay() {
        const tagList = document.getElementById('selected-tags-list');
        if (!tagList) return;

        // 既存の内容をクリア
        tagList.innerHTML = '';

        if (selectedTags.size === 0) {
            const message = document.createElement('div');
            message.style.color = '#666';
            message.textContent = 'タグが選択されていません';
            tagList.appendChild(message);
            return;
        }

        // 選択されているタグを表示
        Array.from(selectedTags).sort().forEach(tag => {
            const tagDiv = document.createElement('div');
            tagDiv.style.cssText = `
                margin: 5px 0;
                padding: 5px;
                background: #f8f8f8;
                border-radius: 3px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;

            const tagText = document.createElement('span');
            tagText.textContent = tag;
            tagText.style.marginRight = '10px';
            // alert_colorクラスを持つタグを赤色で表示
            const isAlertTag = Array.from(document.querySelectorAll('.alert_color'))
                .some(el => el.textContent.trim() === tag);
            if (isAlertTag) {
                tagText.style.color = '#ff0000';
            }

            const removeButton = document.createElement('span');
            removeButton.textContent = '×';
            removeButton.style.cssText = `
                cursor: pointer;
                color: #666;
                padding: 0 5px;
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

    // 小説をフィルタリングする関数
    function filterNovels() {
        document.querySelectorAll('.section3').forEach(novel => {
            const tagElements = novel.querySelectorAll('.all_keyword a');
            const novelTags = new Set(
                Array.from(tagElements)
                    .map(tag => tag.textContent.trim())
                    .filter(tag => tag.length > 0)
            );

            if (selectedTags.size === 0) {
                novel.style.display = '';
            } else if (isAndMode) {
                // ANDモード: すべての選択タグを含む必要がある
                const hasAllTags = Array.from(selectedTags)
                    .every(tag => novelTags.has(tag));
                novel.style.display = hasAllTags ? '' : 'none';
            } else {
                // ORモード: いずれかの選択タグを含む
                const hasAnyTag = Array.from(selectedTags)
                    .some(tag => novelTags.has(tag));
                novel.style.display = hasAnyTag ? '' : 'none';
            }
        });
    }

    // メイン処理
    function init() {
        const waitForContent = () => {
            // .section3クラスの要素を待つ
            if (!document.querySelector('.section3')) {
                setTimeout(waitForContent, 500);
                return;
            }

            // タグセレクターを作成
            const tagSelector = createTagSelector();
            document.body.appendChild(tagSelector);

            // [+]ボタンを追加
            addPlusButtons();

            // 初期表示を更新
            updateSelectedTagsDisplay();
        };

        waitForContent();
    }

    // DOMの読み込み完了後に実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();