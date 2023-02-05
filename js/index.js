'use strict';

var App = function(props) {
    var self = this;

    var $ = function(selector) {
        return document.getElementsByClassName(selector)[0];
    };

    var ajax = function(opts) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                typeof opts.success === 'function' && opts.success(xhr);
            }
        };
        xhr.onerror = typeof opts.error === 'function' ? opts.error.bind(undefined, xhr) : null;
        xhr.open(opts.type || 'GET', opts.url);
        // xhr.setRequestHeader('Content-Type', "application/json; charset=utf-8" /*'application/x-www-form-urlencoded'*/);
        xhr.send(opts.data || null);
    };

    var getX = function(e) {
        if (e.touches) {
            return e.touches[0].screenX;
        } else {
            return e.screenX;
        }
    };

    var loadImage = function(opts) {
        opts.appendContainer || (opts.appendContainer = opts.container);

        var resize = function() {
            if (this.naturalWidth / this.naturalHeight < opts.appendContainer.clientWidth / opts.appendContainer.clientHeight) {
                this.style.width = '100%';
                this.style.height = 'auto';
            } else {
                this.style.width = 'auto';
                this.style.height = '100%';
            }
        };

        var img = document.createElement('img');

        img.addEventListener('load', function() {
            opts.container.classList.remove('loading');
            resize.call(this);
            window.addEventListener('resize', resize.bind(this));
            this.width;
            this.classList.add('loaded');

            typeof opts.load === 'function' && opts.load.call(this);
        });

        img.addEventListener('error', function() {
            opts.container.classList.remove('loading');
            opts.container.classList.add('loading-error');
            var errorEl = document.createElement('span');
            var errorText = document.createTextNode('Failed to load image');

            errorEl.classList.add('error');
            errorEl.appendChild(errorText);
            opts.appendContainer.appendChild(errorEl);

            typeof opts.error === 'function' && opts.error.call(this);
        });

        opts.container.classList.add('loading');

        img.src = opts.src;
        opts.appendContainer.appendChild(img);
    };


    var escHide = function(e) {
        if (e.keyCode === 27) {
            self.actions.hidePreview();
        }
    };

    var DOM = this.DOM = {
        counter: $('counter'),
        current: $('current'),
        total: $('total'),
        slider: $('slider'),
        sPrev: null,
        sNext: null,
        sCurrent: null,
        screen: $('screen'),
        grid: $('grid'),
        controls: {
            screen: $('m-screen'),
            grid: $('m-grid')
        },
        gFull: $('grid-full'),
        gFullImage: $('gf-image'),
        gItems: document.getElementsByClassName('g-item')
    };

    var props = this.props = {
        // grid view block width
        blockWidth: 256,
        // grid view block height
        blockHeight: 256,
        // time for the image to stay in place before scaling
        scaleDelay: 300,
        // minimum amount of pixels the cursor/finger should move to trigger the transition
        threshold: 80,
        // how much should the image movement scale, has no effect on treshold
        moveMultiplier: 2,

        touch: 'ontouchstart' in document,
        get events() {
            return {
                start: this.touch ? 'touchstart' : 'mousedown',
                move: this.touch ? 'touchmove' : 'mousemove',
                end: this.touch ? 'touchend' : 'mouseup'
            }
        }
    };

    var state = this.state = {
        imageIndex: 0,
        sliderLocked: false,
        sliderInitiated: false,
        blockWidth: 0,
        blockHeight: 0,
        mode: null,
        images: []
    };

    this.actions = {
        loadImages: function(callback) {

            if (state.images.length) {
                return;
            }

            ajax({
                url: './js/images.json',
                type: 'GET',
                success: function(xhr) {
                    var images;
                    try {
                        images = JSON.parse(xhr.response);
                    } catch(e) {
                        console.warn('failed to parse JSON');
                        images = [];
                    }
                    state.images = images;
                    callback && callback();
                },
                error: function() {
                    console.warn('failed to load images array');
                }
            });
        },
        addEventListener: function() {
            var close
        },
        showPreview: function() {
            var item = this;

            Array.prototype.forEach.call(DOM.gItems, function(el) {
                el.classList.remove('loading');
            });

            DOM.gFullImage.innerHTML = '';

            loadImage({
                src: item.href,
                container: item,
                appendContainer: DOM.gFullImage,
                load: function() {
                    // since we always preserve ratio, it doesn't matter which side to use
                    var scale = item.getElementsByTagName('img')[0].clientWidth / this.clientWidth;
                    var itemRect = item.getBoundingClientRect();
                    var offset = {
                        x: itemRect.left + item.clientWidth / 2 - DOM.gFullImage.clientWidth / 2,
                        y: itemRect.top + item.clientHeight / 2 - DOM.gFullImage.clientHeight / 2
                    };

                    DOM.gFullImage.style.transform = 'translate3d(' + offset.x + 'px, ' + offset.y + 'px, 0) scale(' + scale + ')';

                    setTimeout(function() {
                        DOM.gFullImage.style.transform = 'translate3d(0px, 0px, 0px) scale(1)'; // bugged on iOS
                        DOM.gFullImage.classList.add('scale-fullscreen');
                    }, props.scaleDelay);

                    DOM.gFull.classList.add('active');

                    state.imageIndex = parseInt(item.getAttribute('data-index'), 10);
                    self.actions.updateHash();
                }
            });

            document.body.addEventListener('keydown', escHide);
        },
        hidePreview: function() {
            DOM.gFull.classList.remove('active');
            DOM.gFullImage.style.transform = ''; // if closed before delay
            DOM.gFullImage.classList.remove('scale-fullscreen');
            document.body.removeEventListener('keydown', escHide);
        },
        changeMode: function(mode) {

            if (!state.images.length) {
                console.warn('images not loaded');
                return;
            }

            if (mode === state.mode) {
                return;
            }

            state.mode = mode;

            switch(mode) {
                case 'screen':
                    DOM.grid.style.display = 'none';
                    DOM.screen.style.display = 'block';
                    DOM.gFull.style.display = 'none';
                    DOM.counter.style.display = 'block';
                    DOM.controls.screen.classList.add('active');
                    DOM.controls.grid.classList.remove('active');

                    var addItem = function(position) {
                        var item = document.createElement('div');
                        var index;

                        switch(position) {
                            case 'prev':
                                if ((index = state.imageIndex - 1) < 0) {
                                    index = state.images.length - 1;
                                }
                            break;
                            case 'next':
                                if ((index = state.imageIndex + 1) > state.images.length - 1) {
                                    index = 0;
                                }
                            break;
                            case 'current':
                                index = state.imageIndex;
                            break;
                            default:
                                console.warn('bad item position');
                                return;
                        }

                        loadImage({
                            container: item,
                            src: state.images[index].full
                        });

                        item.classList.add('s-item');
                        item.classList.add('s-' + position);

                        DOM.slider.appendChild(item);

                        return item;
                    };

                    var deltaX;
                    var initialX = 0;

                    var onDown = function(e) {
                        deltaX = 0;
                        e.preventDefault();
                        if (state.sliderLocked) {
                            return;
                        }
                        initialX = getX(e);
                        DOM.slider.addEventListener(props.events.move, onMove);
                        document.addEventListener(props.events.end, onUp);
                        if (props.touch) {
                            document.addEventListener('touchcancel', onUp);
                        }
                    };

                    var onMove = function(e) {
                        deltaX = getX(e) - initialX;
                        DOM.sCurrent.style.transform = 'translate3d(' + deltaX * props.moveMultiplier +  'px, 0px, 0px)';
                        if (deltaX > 0) {
                            DOM.slider.classList.add('peek-prev');
                        } else {
                            DOM.slider.classList.remove('peek-prev');
                        }
                    };

                    var onUp = function(e) {
                        DOM.slider.removeEventListener(props.events.move, onMove);
                        document.removeEventListener(props.events.end, onUp);
                        if (props.touch) {
                            document.removeEventListener('touchcancel', onUp);
                        }

                        var moveClass;
                        if (deltaX === 0 || deltaX < -props.threshold) {
                            moveClass = 'move-next';
                        } else if (deltaX > props.threshold) {
                            moveClass = 'move-prev';
                        } else {
                            moveClass = 'move-start';
                        }
                        DOM.sCurrent.classList.add(moveClass);

                        state.sliderLocked = true;

                        var onAnimationend = function() {
                            DOM.sCurrent.classList.remove(moveClass);
                            DOM.sCurrent.style.transform = 'translate3d(0px, 0px, 0px)';
                            DOM.sCurrent.removeEventListener('animationend', onAnimationend);

                            var newItem;
                            if (moveClass === 'move-next') {
                                DOM.sPrev.remove();
                                DOM.sPrev = DOM.sCurrent;

                                DOM.sNext.classList.remove('s-next');
                                DOM.sNext.classList.add('s-current');

                                DOM.sCurrent.classList.remove('s-current');
                                DOM.sCurrent.classList.add('s-prev');
                                DOM.sCurrent = DOM.sNext;

                                state.imageIndex = ++state.imageIndex > state.images.length - 1 ? 0 : state.imageIndex;
                                newItem = addItem('next');
                                DOM.sNext = newItem;
                            } else if (moveClass === 'move-prev') {
                                DOM.sNext.remove();
                                DOM.sNext = DOM.sCurrent;

                                DOM.sPrev.classList.remove('s-prev');
                                DOM.sPrev.classList.add('s-current');

                                DOM.sCurrent.classList.remove('s-current');
                                DOM.sCurrent.classList.add('s-next');
                                DOM.sCurrent = DOM.sPrev;

                                state.imageIndex = --state.imageIndex < 0 ? state.images.length - 1 : state.imageIndex;
                                newItem = addItem('prev');
                                DOM.sPrev = newItem;
                            }
                            self.actions.updateHash();
                            state.sliderLocked = false;
                        };

                        DOM.sCurrent.addEventListener('animationend', onAnimationend);
                    };

                    if (!state.sliderInitiated) {
                        DOM.slider.addEventListener(props.events.start, onDown);
                        state.sliderInitiated = true;
                    }

                    DOM.slider.innerHTML = '';

                    DOM.sCurrent = addItem('current');
                    DOM.sPrev = addItem('prev');
                    DOM.sNext = addItem('next');

                break;
                case 'grid':
                    DOM.grid.style.display = 'block';
                    DOM.screen.style.display = 'none';
                    DOM.gFull.style.display = 'block';
                    DOM.counter.style.display = 'none';
                    DOM.controls.screen.classList.remove('active');
                    DOM.controls.grid.classList.add('active');

                    var addItem = function(index, src) {
                        var item = document.createElement('a');
                        item.classList.add('g-item');
                        item.setAttribute('data-action', 'showPreview');
                        item.setAttribute('data-index', index);
                        item.href = src.full;

                        loadImage({
                            src: src.preview,
                            container: item,
                            load: function() {
                                item.style.width = state.blockWidth + 'px';
                                item.style.height = state.blockHeight + 'px';
                            },
                            error: function() {
                                item.style.width = state.blockWidth + 'px';
                                item.style.height = state.blockHeight + 'px';
                            }
                        })

                        DOM.grid.appendChild(item);
                    };

                    var resizeGrid = function() {
                        var columns = DOM.grid.clientWidth / props.blockWidth >> 0;
                        state.blockWidth = DOM.grid.clientWidth / columns;
                        state.blockHeight = DOM.grid.clientWidth / columns;
                    };

                    resizeGrid();

                    window.addEventListener('resize', function() {
                        resizeGrid();

                        Array.prototype.forEach.call(DOM.gItems, function(el) {
                            el.style.width = state.blockWidth + 'px';
                            el.style.height = state.blockHeight + 'px';
                        });
                    });

                    DOM.grid.innerHTML = '';

                    state.images.forEach(function(el, i) {
                        if (el && el.preview && el.full) {
                            setTimeout(addItem.bind(null, i, el), i * 40);
                        } else {
                            console.warn('bad urls for object', el);
                        }
                    });

                break;
                default:
                    console.warn('bad mode');
            }
        },
        setHash: function() {
            var hashIndex = parseInt(location.hash.substr(1), 10);

            if (!isNaN(hashIndex) && isFinite(hashIndex) && hashIndex > 0 && hashIndex <= state.images.length) {
                state.imageIndex = --hashIndex;
            }

            self.actions.updateHash();
        },
        updateHash: function() {
            self.actions.updateCurrent();
            history.replaceState(null, null, '#' + (state.imageIndex + 1));
        },
        updateCurrent: function() {
            DOM.current.innerHTML = state.imageIndex + 1;
        },
        init: function() {
            self.actions.loadImages(function() {
                self.actions.setHash();
                self.actions.changeMode('screen');
                DOM.total.innerHTML = state.images.length;
            });
        }
    };

    this.actions.init();
};


document.addEventListener('DOMContentLoaded', function() {
    var app = new App();

    document.body.addEventListener('click', function(e) {
        var target = e.target;
        var action;

        while (target) {
            if (action = target.getAttribute('data-action')) {
                break;
            }
            target = target.parentElement;
        }

        if (!target) {
            return;
        }

        if (target.tagName === 'A') {
            e.preventDefault();
        }

        var value = target.getAttribute('data-value');

        if (action in app.actions) {
            app.actions[action].call(target, value);
        } else {
            console.warn('Unknown action');
        }
    });
});
