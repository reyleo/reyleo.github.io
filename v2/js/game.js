const _Game = (function(){

const version = "0.2.2";
const svgNS = "http://www.w3.org/2000/svg";
const xlinkNS = "http://www.w3.org/1999/xlink";


function Card(p) {
	this.color = p[0];
	this.shape = p[1];
	this.quantity = p[2] + 1;
	this.fill = p[3];
}
Card.prototype.toString = function() {
	return this.color + ', ' + this.shape + ', ' + this.quantity + ', ' + this.fill;
}
Card.prototype.toArray = function() {
	return [this.color, this.shape, this.quantity - 1, this.fill];
}
Card.prototype._shapes = ["pill", "curve", "rhomb"];
Card.prototype._colors = ["red", "green", "purple"];
Card.prototype._fills = ["empty", "filled", "stripes"];

Card.prototype.render = function(cardElem) {
	if (cardElem != null) {
		if (cardElem.hasChildNodes()) {
			cardElem.removeChild(cardElem.firstChild);
		}

		let group = document.createElement('div');
		group.classList.add('group', 'group' + this.quantity);
		for (let i = 0; i < this.quantity; i++) {
			group.appendChild(this.createSymbol());
		}
		cardElem.appendChild(group);
	}
};

Card.prototype.createSymbol = function() {
	let svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute('class', "symbol");
	svg.setAttribute('viewBox','0 0 200 100');
	svg.style.width = "100%";

	let symbol = document.getElementById("symbol-" + this._shapes[this.shape]).cloneNode();
	symbol.removeAttribute('id');
	symbol.setAttribute('class', this._colors[this.color] + " " + this._fills[this.fill]);
	svg.appendChild(symbol);
	return svg;
};


function Player(id) {

	if (!(this instanceof Player)) {
		return new Player(id);
	}
	this.id = id;
	this.name = "";
	this.wins = 0;
	this.fails = 0;
	this.layout = '';
	this.class = '';
	this.position = '';
	this.area = null;
}

Player.prototype.resetScore = function() {
	this.wins = 0;
	this.fails = 0;
};

Player.prototype.points = function() {
	return this.wins - this.fails;
};

Player.prototype.isValid = function() {
	return this.class !== '' && typeof this.id !== undefined;
};

Player.prototype.isTopPosition = function() {
	return this.class === 'player-top';
}

Player.prototype.setPosition = function(position) {
	if (position === 'top' || position === 'bottom') {
		this.layout = 'horizontal';
	} else if (position === 'right' || position === 'left') {
		this.layout = 'vertical';
	} else {
		player.class = '';
		return;
	}
	this.position = position;
	this.class = 'player-' + position;
};

Player.prototype.increaseWins = function() {
	this.wins++;
	this.area.querySelector('.win-counter').innerHTML = this.wins;
	this.area.classList.remove('clicked');
	const timer = this.area.querySelector('.player-timer');
	if (timer) timer.remove();
};

Player.prototype.increaseFails = function() {
	this.fails++;
	this.area.querySelector('.fail-counter').innerHTML = this.fails;
	this.area.classList.remove('clicked');
	const timer = this.area.querySelector('.player-timer');
	if (timer) timer.remove();
};

const Status = { active: 0, pause: 1, over: 2, init: 3 };

function applyStyle(el, obj) {
	Object.assign(el.style, obj);
}
function _show(el) {
	if (!el) return;
	el.style.display = 'block';
}
function _hide(el) {
	if (!el) return;
	el.style.display = 'none';
}
function _id(id) {
	return document.getElementById(id);
}
function _q(select) {
	return document.querySelector(select);
}
function _qa(select) {
	return document.querySelectorAll(select);
}
function _visible(e) {
	return e.offsetHeight > 0 || e.offsetWidth > 0;
}
function _el(tag, ...classList) {
	const el = document.createElement(tag);
	const valid = classList.filter((cl) => !!cl);
	if (valid.length > 0) el.classList.add(...valid);
	return el;
}

const Game = (function(){

	let _board = null;
	let _cardsLeft = 0;
	let _deck = [];
	let _next = 0;
	let _counter = null;
	let _players = [];
	let _player = null;
	let _queue = [];
	let _timer = null;
	let _countDown;
	let _setup = {
		player: 0,
		next: false
	};
	let _status = Status.active;
	let _eventName = "";
	let _selectionDone = false;
	let _clockTimer = new Timer(updateTime);
	let _clockWidget = null;
	let _exit = false;
	let _userPause = false;
	let _replayMode = false;

	let _topResults = [];

	let config = {
		rows: 3,
		columns: 4,
		maxColumns: 5,
		cardHeight: 200,
		cardWidth: 300,
		keepScore: false,
		maxTime: 10,
		showSetOnHint: true
	};
	let boardPadding = 0;
	let _isStorageAvailable = false;
	let _debug = false;

	let debug = function(str) {
		if (_debug) {
			window.console.log(str);
		}
	};

	function isPause() {
		return _status == Status.pause;
	}

	function updateTime (timer) {
		_clockWidget.innerHTML = timer.toString();
		//saveTime(timer);
	}

	function isSinglePlayer() {
		return _players.length == 1;
	}

	function isTimerOn() {
		return isSinglePlayer();
	}

	function showTime () {
		if (isTimerOn()) {
			_show(_clockWidget);
		}
	}

	function startTime() {
		if (isTimerOn()) {
			_clockTimer.start();
		}
	}

	function load() {
		if (!_isStorageAvailable) return false;
		let data = localStorage.getItem('data');

		if (data && data.length > 0) {
			let state = JSON.parse(data);
			debug('Data loaded: ' + data);
			_deck = [];
			for (let i = 0; i < state.deck.length; i++) {
				_deck.push(new Card(state.deck[i]));
			}
			_next = state.next;
			_cardsLeft = _deck.length - _next;
			_status = state.status;
			_replayMode = !!state.replayMode;
			if (state.topResults) _topResults = state.topResults;

			const playerIsValid = (data) => data.class && data.class !== '';
			if (!state.players || state.players.length == 0 || !state.players.every(playerIsValid)) {
				return false;
			}
			loadPlayers(state.players);
			fillBoard(state.board);
			if (isSinglePlayer()) {
				if (_status == Status.active) {
					_clockTimer.start(state.timer);
				} else {
					_clockTimer.setTime(state.timer);
					updateTime(_clockTimer);
				}
				_show(_clockWidget);
			} else {
				_hide(_clockWidget);
			}

			if (_status == Status.over) {
				findWinners();
			}
			return true;
		}
		return false;
	}

	function saveTime(timer) {
		if (_isStorageAvailable) {
			localStorage.setItem('time', timer.getTime());
		}
	}

	function save() {
		if (!_isStorageAvailable) return;

		let deckArr = _deck.map((card) => card.toArray());

		let state = {
			'version': version,
			'deck': deckArr,
			'next': _next,
			'players': savePlayers(),
			'status': _status,
			'timer': _clockTimer.getTime(),
			'board': getBoard(),
			'topResults': _topResults,
			'replayMode': _replayMode
		};
		const data = JSON.stringify(state);
		//debug('Saving data: ' + data);
		localStorage.setItem('data', data);
		//saveTime(_clockTimer);
	}

	function copyPlayer(player) {
		let newObj = Object.assign({}, player);
		if (newObj.area) newObj.area = null;
		return newObj;
	}

	function savePlayers() {
		return _players.map(copyPlayer);
	}

	function buildPlayerWithArea(playerData) {
		let newPlayer = Object.assign(new Player(), playerData);
		createArea(newPlayer);
		return newPlayer;
	}

	function loadPlayers(playersData) {
		_players = playersData.map(buildPlayerWithArea);
		initPlayers();
	}

	function getBoard() {
		let board = [];
		_board.querySelectorAll('.cardHolder').forEach(function(holder) {
			const cardElem = holder.querySelector('.card');
			board.push(cardElem !== null? cardElem.card.toArray() : null);
		});
		return board;
	}

	function fillBoard(board) {
		let columns = _board.querySelectorAll('.column');
		if (board.length > (config.rows * columns.length)) {
			appendColumn();
		}
		_board.querySelectorAll('.cardHolder').forEach(function(holder, index) {
			const card = holder.querySelector('.card')
			if (card) card.remove();
			if (board[index] != null) {
				placeCard(holder, new Card(board[index]), false);
			}
		});
	}

	function deal(animate = false) {
		let places = document.querySelectorAll('#gameBoard .cardHolder');
		let elem, card, count = 0;

		// remove animation
		cards().forEach((card) => card.classList.remove('animate'));

		for (let i = 0; i < places.length; i++) {
			elem = places[i].querySelector('.card');
			if (elem == null) {
				card = next();
				if (card != null) {
					count++;
					placeCard(places[i], card, animate);
				} else {
					break;
				}
			}
		}
		_cardsLeft = _deck.length - _next;
		debug("Added " + count + " cards, " + _cardsLeft + " left");
		if (_counter) {
			_counter.innerHTML = "" + _cardsLeft;
		}
	};

	function placeCard(place, card, animate) {
		let cardElem = _el('div','card');
		applyStyle(cardElem, cardCss());
		cardElem.card = card;
		card.render(cardElem);
		if (animate) {
			cardElem.classList.add('animate')
		}
		place.appendChild(cardElem);
	}

	function checkForMore() {
		var setNotFound = (findSet() == null);
		if (setNotFound) {
			debug("checkForMore: set not found, " + _cardsLeft + " cards left");
			if (_cardsLeft > 0) {
				if (addMore()) {
					deal(true);
					setNotFound = findSet() == null;
				}
			}
		}
		if (setNotFound) {
			gameOver();
		}
	}

	function gameOver() {
		findWinners();
		_status = Status.over;
		_clockTimer.stop();
		updateTime(_clockTimer);
		// save top result if all cards played
		let topResult = false;
		if (isSinglePlayer() && _cardsLeft == 0 && !_replayMode) {
			// get time in msec
			const time = _clockTimer.getTime();
			const position = checkTopResult(time);
			if (position !== -1) {
				topResult = true;
				showTopResults(position);
			}
		}
		save();
		if (!topResult) {
			instruction("Game over", 'normal', 2000);
		}
	}

	function findWinners() {
		let winners = [];
		let maxPoints = -999;

		_players.forEach((player) => {
			let points = player.points();
			if (points == maxPoints) {
				winners.push(player);
			} else if (points > maxPoints) {
				winners = [player];
				maxPoints = points;
			}
		});
		//debug("Max points " + maxPoints + ", winners = " + winners.length);
		winners.forEach((winner) => winner.area.classList.add('winner'));
	}

	function newTopResult(time) {
		let formatted = '';
		if (toLocaleDateStringSupportsLocales()) {
			formatted = (new Date()).toLocaleDateString(navigator.language, {
				month: 'numeric', year: 'numeric', day: 'numeric'
			})
		} else {
			formatted = (new Date()).toISOString().substring(0, 10)
		}
		return {
			time: time,
			date: formatted
		}
	}

	function checkTopResult(time) {
		for (let i = 0; i < _topResults.length; i++) {
			if ( time < _topResults[i].time ) {
				_topResults.splice(i, 0, newTopResult(time));
				if (_topResults.length > 10) {
					// pop last result :(
					_topResults.pop();
				}
				return i;
			}
		}
		if (_topResults.length < 10) {
			_topResults.push(newTopResult(time));
			return _topResults.length-1;
		}
		return -1;
	}

	function showTopResults(current = -1) {
		var list = document.querySelector('#topResults ol');
		list.innerHTML = '';
		_topResults.forEach(function(_top, index) {
			var item = document.createElement('li');
			item.insertAdjacentText('afterbegin', Timer.formatTime(_top.time));
			item.insertAdjacentHTML('beforeend',`<span class="date">${_top.date}</span>`);
			if (current == index) {
				item.classList.add('current');
			}
			list.appendChild(item);
		});
		showDialog('topResults');
	}

	function clearTopResults() {
		_topResults = [];
		document.querySelectorAll('#topResults li').forEach((item) => item.innerHTML = '');
	}
	/*
	 * Get next card from deck and move pointer
	 */
	function next() {
		let card = null;
		if (_next < _deck.length) {
			card = _deck[_next];
			_next++;
		}
		return card;
	}
	/*
	 * Shuffle cards in the deck
	 */
	function shuffle() {
		let count = _deck.length;
		let pos;
		let temp;
		while (count > 0) {
			pos = Math.floor(Math.random() * count);
			count -= 1;
			temp = _deck[count];
			_deck[count] = _deck[pos];
			_deck[pos] = temp;
		}
	}

	function findSet() {
		let boardCards = cards();
		// is board empty?
		if (boardCards.length == 0) return null;

		let combination = [0, 1, 2];
		let selection;
		let j, k, m, max = boardCards.length - 1;
		let n = combination.length - 1;

		do {

			selection = [];

			for (j = 0; j < combination.length; j++) {
				selection.push(boardCards.item(combination[j]));
			}
			if (checkSet(selection)) {
				debug("findSet - set found in " + boardCards.length + " cards");
				return selection;
			}
			for (k = n, m = max; k >= 0; k--,m--) {
				if (combination[k] < m) {
					combination[k]++;
					for (j = k+1; j < combination.length; j++) {
						combination[j] = combination[j-1] + 1;
					}
					break;
				}
			}
			if (k < 0) {
				break;
			}

		} while (true);
		debug("findSet - not found in " + boardCards.length + " cards");
		return null;
	}

	function nextCombination(p, max) {
		let pos = p.length - 1;

		while (pos >= 0) {
			if (p[pos] >= max) {
				p[pos] = 0;
				pos--;
			} else {
				p[pos] += 1;
				return true;
			}
		}

		return false;
	}

	function restart(options = {replay: false}) {
		_next = 0;
		_cardsLeft = _deck.length;
		_status = Status.active;
		clear();
		if (!options.replay) shuffle();
		_replayMode = !!options.replay;
		if (!config.keepScore) {
			resetScore();
		}
		_clockTimer.stop();
		if (_players.length > 1) {
			_hide(_clockWidget);
		} else {
			_clockTimer.stop();
			_clockTimer.start();
			_show(_clockWidget);
		}
		deal();
		checkForMore();
		save();
	}

	function replay() {
		restart({replay: true});
	}

	function resetScore() {
		_players.forEach((player) => player.resetScore());
		document.querySelectorAll('.win-counter,.fail-counter').forEach((el) => el.innerHTML = '0');
	}

	function clear() {
		clearTimers();
		cards().forEach((card) => card.remove());
		_player = null;
		document.querySelectorAll('.player-area').forEach((el) => el.classList.remove('clicked', 'winner', 'queue'));
		let columnRemoved = false;
		_board.querySelectorAll('.column').forEach(function(col, index) {
			if (index > config.columns-1) {
				col.remove();
				columnRemoved = true;
			}
		});
		if (columnRemoved) {
			onColumnNumberChange();
		}
	}

	function commandMore() {
		addMore();
		deal(true);
	}

	function addMore() {
		let columns = _board.querySelectorAll('.column');
		if (columns.length == config.maxColumns) return false;
		appendColumn();
		onColumnNumberChange();
		debug("1 column added")
		return true;
	}

	function appendColumn() {
		let column = _el('div', 'column');
		column.style.width = config.cardWidth + 'px';
		for (let j = 0; j < config.rows; j++) {
			let cardHolder = _el('div', 'cardHolder');
			applyStyle(cardHolder, cardHolderCss());
			column.appendChild(cardHolder);
		}
		document.getElementById('columns').appendChild(column);
	}

	function calcHeight() {
		let h1 = Math.floor(_board.offsetHeight * 0.9 / config.rows);
		let boardWidth = _board.offsetWidth;
		let colCount = _board.querySelectorAll('.column').length;
		let colWidth = 1/colCount - 0.02;
		let w2 = Math.floor(boardWidth * colWidth);
		//var w2 = Math.floor(boardWidth * 0.18);
		w2 -= w2 % 2;
		h1 -= h1 % 3;
		let h2 = w2/2 * 3;
		if (h2 < h1) {
			//console.log('h1=' + h1 + ', h2=' + h2 + ', w2=' + w2 + ', width=' + boardWidth);
		}
		return Math.min(h1, h2);
	}

	function cardHolderCss() {
		let margin = Math.floor(config.cardHeight * 0.075);
		let totalHeight = config.cardHeight * 3 + margin * 4;
		debug("Card height=" + config.cardHeight + ', margin = ' + margin + ", Total height = " + totalHeight);
		return {
			'height': config.cardHeight + 'px',
			'margin-top': margin + 'px',
			'margin-bottom': margin + 'px'
		};
	}

	function cardCss() {
		const r = Math.round(config.cardHeight * 0.06);
		return {
			'height': config.cardHeight + 'px',
			'width': config.cardWidth + 'px',
			'border-radius': r + 'px'
		};
	}

	function calcCardSize() {
		let h = calcHeight();
		if (h != config.cardHeight) {
			config.cardHeight = h;
			config.cardWidth = h / 3 * 2;
		}
	}

	function onColumnNumberChange() {
		resizeCards();
	}

	function resizeCards() {
		calcCardSize();
		const cardStyles = cardCss();
		const holderStyles = cardHolderCss();
		_board.querySelectorAll('.card').forEach((card) => applyStyle(card, cardStyles));
		_board.querySelectorAll('.cardHolder').forEach((el) => applyStyle(el, holderStyles));

		let bw = _board.offsetWidth;
		let colMargin = Math.floor(bw * 0.01);

		const columnStyle = {
			'width': config.cardWidth + 'px',
			'margin-right': '' + colMargin + 'px',
			'margin-left': '' + colMargin + 'px',
		};

		const cols = _board.querySelectorAll('.column');
		cols.forEach((el) => applyStyle(el, columnStyle));
		let colCount = cols.length;
		let realWidth = (config.cardWidth + colMargin * 2) * colCount;
		document.getElementById('columns').style.width = realWidth + 'px';
	}

	function resize() {
		let playerPadding = '36pt';
		let noPadding = '0';

		// create paddings for player areas
		let css = {
			'padding-top':    playerPadding,
			'padding-right':  noPadding,
			'padding-bottom': noPadding,
			'padding-left':   noPadding
		};
		_players.map(player => 'padding-' + player.position).forEach(property => css[property] = playerPadding);
		// apply paddings
		applyStyle(document.getElementById('gameContainer'), css);
		// recalculate cards
		let newHeight = calcHeight();
		if (config.cardHeight != newHeight) {
			resizeCards();
		}
		['top','bottom','right','left'].forEach((side) => resizePlayers('player-' + side));

	}

	function escape() {
		if (!_exit) {
			_clockTimer.pause();
			save();
			_exit = true;
		}
	}

	function clickPause(e) {

		if (_status != Status.active && _status != Status.pause) return;
		if (_clockTimer.isRunning()) {
			_clockTimer.pause();
			_clockWidget.innerHTML = 'Paused';
			_hide(_board);
			_userPause = true;
			save();
		} else {
			_clockTimer.start();
			_show(_board);
			_userPause = false;
		}
		e.preventDefault();
	}

	function lookUp(root, el, filter) {
		while (el !== root && el !== null) {
			if (filter(el)) return el;
			el = el.parentNode;
		}
		return null;
	}

	function init() {
		_board = document.getElementById("gameBoard");

		document.getElementById('gameInfo').innerHTML = version;

		boardPadding = _board.offsetTop;
		_isStorageAvailable = storageAvailable();

		for (let i = 0; i < config.columns; i++) {
			appendColumn();
		}
		const MAX_VAL = 2;
		//
		// event handlers
		//
		_eventName = 'click';
		if ('ontouchstart' in document.documentElement) {
			_eventName = 'touchstart';
		}

		_counter = document.getElementById('counter');
		_clockWidget = el('div','game-timer', 'noselect');
		_clockWidget.style.display = 'none';
		document.body.appendChild(_clockWidget);
		_clockWidget.addEventListener(_eventName, clickPause);

		const isCardElement = function(e) {
			return e.nodeType == Node.ELEMENT_NODE && e.classList.contains('card');
		};

		_board.addEventListener(_eventName, function (ev) {
			const card = lookUp(_board, ev.target, isCardElement);
			if (card != null) {
				ev.stopPropagation();
				onCardSelect(card);
			}
		});

		const stopPropagation = function(event) {
			event.stopPropagation();
			event.preventDefault();
			return false;
		};

		_board.addEventListener('dblclick', stopPropagation);

		_qa('#setupDialog .button').forEach(
			(btn) => btn.addEventListener(_eventName,
				function () {
					let count = parseInt(this.innerHTML);
					hideDialog('setupDialog');
					createPlayers(count);
					runSetup();
				})
		);

		const keepScoreConfig = _q('#keepScore')
		keepScoreConfig.addEventListener(_eventName, function(ev) {
				const el = ev.target;
				var newval = !el.checked;
				el.checked = newval;
				config.keepScore = newval;
				this.className = "check " + (el.checked ? 'check-on' : 'check-off');
			});
		keepScoreConfig.classList.add(config.keepScore ? 'check-on' : 'check-off')
		keepScoreConfig.checked = config.keepScore;


		_q('#setupDialog .close').addEventListener(_eventName, function() {
			hideDialog('setupDialog');
			_show(_id('menuSwitch'));
			if (!_userPause) {
				_show(_board);
				if (_status == Status.active) {
					startTime();
				}
			}
			showTime();
		});

		_id('clearResults').addEventListener(_eventName, clearTopResults);

		window.addEventListener('unload', escape);
		window.addEventListener('pagehide', escape);
		window.addEventListener('beforeunload', escape);

		if (!load()) {
			let cardIndex = 0;
			let p = [0, 0, 0, 0];

			do {
				_deck[cardIndex++] = new Card(p);
			} while (nextCombination(p, MAX_VAL));

			// create 1 player
			createPlayers(1);
			_players[0].setPosition('bottom');
			createArea(_players[0]);
			initPlayers();

			// finally restart game
			restart();
		}
		resize();
	}

	function setup() {
		showDialog('setupDialog');
		_hide(_board);
		_hide(_clockWidget);
		if (!_userPause) {
			_clockTimer.pause();
		}
		menuSwitch('off');
		_hide(_id('menuSwitch'))
		_status = Status.init;
	}

	function onPlayerAreaSelect(event) {
		let wh = window.innerHeight;
		let ww = window.innerWidth;
		let clickX = _eventName == 'click' ? event.pageX : event.targetTouches.item(0).pageX;
		let clickY = _eventName == 'click' ? event.pageY : event.targetTouches.item(0).pageY;
		let player = _players[_setup.player];
		if (clickY < boardPadding) {
			player.setPosition('top');
		} else if (clickY > (wh - boardPadding)) {
			player.setPosition('bottom');
		} else if (clickX < boardPadding) {
			player.setPosition('left');
		} else if (clickX > (ww - boardPadding)) {
			player.setPosition('right');
		}
		if (!player.isValid() ||
				(isSinglePlayer() && player.isTopPosition())) {
			window.setTimeout(setupPlayer, 1000);
			instruction('Incorrect place', 'red');
			return;
		}

		if (player.isValid()) {
			createArea(player);
			if (_setup.next && _setup.player < _players.length-1) {
				_setup.player++;
				window.setTimeout(setupPlayer, 10);
			} else {
				finishSetup();
			}

		}
	}

	function setupPlayer() {
		instruction('Select area for player ' + (_setup.player + 1));
		document.addEventListener(_eventName, onPlayerAreaSelect, { once: true });
	}

	function finishSetup() {
		_show(_board);
		_show(_id('menuSwitch'));
		resize();
		_hide(_id('gameMessage'));
		initPlayers();
		restart();
	}

	function createArea(player) {
		let area = _el('div', 'player-area', 'noselect', player.class);
		let contents = _el('div', 'player-contents');
		document.body.insertAdjacentElement('beforeend', area);
		resizePlayers(player.class);
		if (player.position == 'bottom' || player.position == 'left') {
			contents.insertAdjacentHTML('beforeend', '<div class="win-counter">' + player.wins + '</div>');
			contents.insertAdjacentHTML('beforeend', '<div class="fail-counter">' + player.fails + '</div>');
		} else {
			contents.insertAdjacentHTML('beforeend', '<div class="fail-counter">' + player.fails + '</div>');
			contents.insertAdjacentHTML('beforeend', '<div class="win-counter">' + player.wins + '</div>');
		}
		area.appendChild(contents);
		//area.append('<div>' + (_setup.player+1) + '</div>');
		player.area = area;
		area.dataset.player = player.id;
		return area;
	}

	function initPlayers() {
		document.querySelectorAll('.player-area').forEach((area) => {
			area.addEventListener(_eventName, onPlayerAreaClick);
		});
	}

	function onPlayerAreaClick(ev) {
		// do not react on user click if game is over
		// debug('Game status = ' + _status);
		if (_status == Status.over) return;
		if (isSinglePlayer()) return;
		// exit if not first :)
		let clicked = ev.target;
		let clickedId = clicked.dataset.player;

		if (_player != null) {
			// current player cannot go to queue
			if (_player.id != clickedId) {
				addToQueue(_players[clickedId]);
			}
		} else {
			_hide(_id('gameMessage'));
			_player = _players[clickedId];
			clicked.classList.add('clicked');
			// Ensure Queue is empty
			emptyQueue();
			// Timer
			startTimer(clicked);
		}
	}

	function emptyQueue() {
		if (_queue.length == 0) return;
		_queue.forEach(player => player.area.classList.remove('queue'));
		_queue = [];
	}

	function addToQueue(player) {
		if (_queue.some(p => p.id === player.id)) return;
		_queue.push(player);
		debug('Player ' + player.id + ' added to queue');
		player.area.classList.add('queue');
	}

	function nextInQueue() {
		if (_queue.length > 0) {
			_player = _queue.shift();
			debug('Player ' + _player.id + ' taken from queue');
			_player.area.classList.remove('queue')
			_player.area.classList.add('clicked');
			startTimer(_player.area);
		}
	}

	function startTimer(area) {
		_countDown = config.maxTime + 1;
		area.prepend(el('div','player-timer'));
		timerEvent();
	}

	function clearTimers() {
		if (_timer != null) {
			window.clearTimeout(_timer);
			_timer = null;
		}
	}

	function el(tag, ...classes) {
		const elem = document.createElement(tag);
		elem.classList.add(...classes);
		return elem;
	}

	function timerEvent() {
		_countDown--;
		const percent = 100 * (config.maxTime - _countDown) / config.maxTime;
		let t = _player.area.querySelector('.player-timer');
		if (_player.layout == 'horizontal') {
			t.style.width = percent +'%';
		} else {
			t.style.height = percent +'%';
		}
		if (_countDown > 0) {
			_timer = window.setTimeout(timerEvent, 1000);
		} else {
			t.remove();
			playerFail();
			cards().forEach((c) => c.classList.remove('hint', 'selected'));
		}

	}

	function resizePlayers(playerClass) {
		// find same class players
		let same = _qa('.' + playerClass);
		let playerCount = same.length;
		let size = 0, pos = boardPadding;
		if (playerClass == 'player-top' || playerClass == 'player-bottom') {
			size = Math.floor((window.innerWidth - boardPadding*2) / playerCount);
			same.forEach((p) => {
				p.style.width = size + 'px';
				p.style.left = pos + 'px';
				pos += size;
			});
		} else if (playerClass == 'player-left' || playerClass == 'player-right') {
			size = Math.floor((window.innerHeight - boardPadding*2) / playerCount);
			same.forEach((p) => {
				p.style.height = size + 'px'
				p.style.top = pos + 'px';
				pos += size;
			});
		}
	}

	function runSetup() {
		_setup.player = 0;
		_setup.next = true;
		window.setTimeout(setupPlayer, 10);
	}

	function createPlayers(count) {
		_players = [];
		_qa('.player-area').forEach((area) => area.remove());
		for (let id = 0; id < count; id++) {
			_players.push(Player(id));
		}
	}

	function instruction(html, style = 'normal', msec) {
		let delay = (typeof msec == "number")? msec : 0;
		let obj = _id('gameMessage');
		let hdr = obj.firstChild;
		hdr.innerHTML = '';
		hdr.insertAdjacentText('afterbegin', html);
		obj.className = '';
		obj.classList.add('instruction', style);
		_show(obj);
		if (delay > 0) {
			window.setTimeout(instructionOff, delay);
		}
	}

	function instructionOff() {
		_hide(_id('gameMessage'));
	}

	function checkSet(selection) {
		if (selection.length < 3) return false;
		const [c1, c2, c3] = [...selection].map(c => c.card);
		return checkAttribute(c1.color, c2.color, c3.color) &&
			checkAttribute(c1.fill, c2.fill, c3.fill) &&
			checkAttribute(c1.shape, c2.shape, c3.shape) &&
			checkAttribute(c1.quantity, c2.quantity, c3.quantity);
	}

	function checkAttribute(a1, a2, a3) {
		return ((a1 == a2 && a2 == a3) ||
			(a1 != a2 && a1 != a3 && a2 != a3));
	}

	function error(msg) {
		_show(_id('#errorMessage').parentNode);
		window.setTimeout(function(){
				_hide(_id('#errorMessage').parentNode);
			}, 1000);
	};

	function cards() {
		return _board.querySelectorAll('.card');
	}

	function hint(btn) {
		let set = findSet();

		if (config.showSetOnHint) {
			cards().forEach((card) => card.classList.remove('hint', 'selected'));
		}
		if (set) {
			//instruction('Set exists!', 'green', 2000);
			if (config.showSetOnHint) {
				set.forEach((card) => card.classList.add('hint'));
			}
		} else {
			instruction('Not found!', 'error', 2000);
			//showMessage('No set found', 1000);
		}
	}

	function onCardSelect(card) {
		if (_selectionDone || _status == Status.over) return;
		if (_players.length > 1 && _player == null) {
			instruction('Select player first', 'red', 2000);
			return;
		}

		card.classList.remove('hint')
		card.classList.toggle('selected');
		let selection = _board.querySelectorAll('.card.selected');
		if (selection.length == 3) {
			_selectionDone = true;
			clearTimers();
			window.setTimeout(checkSelection, 100);
		}
	}

	function checkSelection() {
		let selection = _board.querySelectorAll('.card.selected');
		cards().forEach((card) => card.classList.remove('hint', 'selected'));
		_selectionDone = false;

		if (checkSet(selection)) {
			// correct SET
			selection.forEach((el) => el.remove());
			let columns = _board.querySelectorAll('.column');
			let moveIndex = 0;
			if (columns.length > config.columns) {
				const lastColumn = columns.item(columns.length-1);
				const movers = lastColumn.querySelectorAll('.card');
				for (let col = 0; col < columns.length-1; col++) {
					const holders = columns.item(col).querySelectorAll('.cardHolder');
					holders.forEach((holder) => {
						if (!holder.hasChildNodes()) {
							holder.appendChild(movers.item(moveIndex++));
						}
					});
				}
				columns.item(columns.length-1).remove();
				onColumnNumberChange();
				debug("1 column removed");
			} else {
				deal(true);
			}
			playerWins();

			// Check if we need more cards
			checkForMore();


		} else {
			wrongSet(selection);
			playerFail();
		}

		save();
	}

	function wrongSet(selection) {
		selection.forEach((card) => card.classList.add("wrong-selection"));
		window.setTimeout(() => {
			selection.forEach((card) => card.classList.remove("wrong-selection"));
		}, 500);
	}

	function autoPlay(delay = 500) {
		let set = findSet();
		if (set != null) {
			set.forEach((card) => card.classList.add('selected'));

			// select random player
			var index = Math.floor(Math.random() * _players.length);
			_player = _players[index];
			checkSelection();
			window.setTimeout(() => autoPlay(delay), delay);
		}
		return true;
	}

	function playerWins() {
		if (isSinglePlayer()) {
			_player = _players[0];
		}
		if (_player == null) return;

		_player.increaseWins();
		_player = null;
		// Queue
		emptyQueue();
	}

	function playerFail() {
		if (isSinglePlayer()) {
			_player = _players[0];
		}
		if (_player == null) return;

		_player.increaseFails();
		_player = null;
		// Queue
		nextInQueue();
		save();
	}

	function getState() {
		return {
			cardsLeft: _cardsLeft,
			counter: _counter,
			status: _status,
			userPause: _userPause,
			replayMode: _replayMode,
			debug: _debug,
		}
	}

	return {
		init: init,
		hint: hint,
		more: commandMore,
		restart: restart,
		setup: setup,
		resize: resize,
		autoPlay: autoPlay,
		topResults: showTopResults,
		replay: replay,
		state: getState,
		status: function() { return _status; },
		version: function() { return version; },
		debugOn: function() { _debug = true; }
	};
})();

function showDialog(id) {
	const dlg = _id(id);
	_show(dlg.parentNode);
	let dw = dlg.offsetWidth;
	let dh = dlg.offsetHeight;
	const ww = window.innerWidth;
	const wh = window.innerHeight;
	dw = Math.min(dw, ww);
	dh = Math.min(dh, wh);

	applyStyle(dlg, {
		top: Math.max(Math.round((wh - dh)/2), 0) + 'px',
		left: Math.max(Math.round((ww - dw)/2), 0) + 'px',
		height: dh + 'px',
		width: dw + 'px'
	});
}

function hideDialog(id) {
	_hide(_id(id).parentNode);
}

function toLocaleDateStringSupportsLocales() {
	try {
		new Date().toLocaleDateString('i');
	} catch (e) {
		return e.name === 'RangeError';
	}
	return false;
}

function storageAvailable() {
	try {
		let storage = window.localStorage;
		let x = '__storage_test__';
		storage.setItem(x, x);
		storage.removeItem(x);
		return true;
	}
	catch(e) {
		return false;
	}
}

/**
 * Document ready
 */
document.addEventListener("DOMContentLoaded", function() {


	let eventName = 'click';
	if ('ontouchstart' in document.documentElement) {
		eventName = 'touchstart';
	}

	/*
	 *   Delayed render fixes issue on Firefox
	 */
	window.setTimeout(function(){
		Game.init();
	}, 10);

/*
	_id('btnHint').addEventListener(eventName, function(ev) {
		Game.hint(ev.target);
		menuSwitch();
	});
*/
	_id('btnStart').addEventListener(eventName, function(){
		Game.restart();
		menuSwitch();
	});

	_id('btnReplay').addEventListener(eventName, function(ev){
		if (ev.target.classList.contains('disabled')) return;
		Game.replay();
		menuSwitch();
	});

	_id('menuSwitch').addEventListener(eventName, menuSwitch );

	_id('btnSetup').addEventListener(eventName, function() {
		Game.setup();
	});

	_q('#topResults .close').addEventListener(eventName, function(ev) {
		_hide(ev.target.closest('.dialog').parentNode);
	});

	_id('btnTop').addEventListener(eventName, function(){
		Game.topResults();
		menuSwitch();
	});

	window.addEventListener('resize', () => Game.resize());
});

function menuSwitch(to = '') {
	const menu = _id('controls');
	if (_visible(menu)) {
		if (to !== 'on') _hide(menu);
	} else {
		if (to !== 'off') {
			_id('btnReplay').classList.toggle('disabled', Game.status() !== Status.over);
			_show(menu);
		}
	}
}
return Game;
})();
