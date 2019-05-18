function Watcher(options) {
	var el = document.querySelector(options.el);
	var cache = el.cloneNode(true);
	var brackets = ["{{", "}}"];
	var regexp = new RegExp("(?<=" + brackets[0] + ")(.*)(?=" + brackets[1] + ")");
	var keywords = [];
	var paths = [];
	var self = this;
	var created = false;

	function findNode(nodes) {
		for(var i = 0; i < nodes.length; i++) {
			if(nodes[i].childNodes.length) {
				findNode(nodes[i].childNodes);
			} else {
				if(regexp.test(nodes[i].data)) {
					findIndex(nodes[i], nodes)
					keywords.push(nodes[i].data.match(regexp)[0].trim());
				}
			}
		}
	}

	function findIndex(node, nodes) {
		if(!findIndex.path) findIndex.path = [];
		if(!findIndex.index) findIndex.index = 0;

		for(var i = 0; i < nodes.length; i++) {
			if(node == nodes[i]) {
				findIndex.path.push(i);

				if(nodes[i].parentNode.parentNode) {
					findIndex(node.parentNode, nodes[i].parentNode.parentNode.childNodes)
				} else {
					paths[findIndex.index] = findIndex.path.reverse();
					findIndex.path = [];
					findIndex.index++;
				}
			}
		}
	}

	function replace(item) {
		var nodes = el;
		var copyCache = cache;
		var chain;
		var result;

		for(var i = 0; i < paths.length; i++) {
			for(var j = 0; j < paths[i].length; j++) {
				nodes = nodes.childNodes[paths[i][j]];
				copyCache = copyCache.childNodes[paths[i][j]];
			}
			chain = copyCache.nodeValue.match(regexp)[0].trim();

			if(created) {
				if(changeCheck(keywords[i])) {
					getResultAndAdd(keywords[i]);
					runWatchProp(keywords[i]);
					replace(keywords[i]);
				}
				if(item && keywords[i] == item) {
					getResultAndAdd(keywords[i]);
				}
			} else {
				create(keywords[i]);
			}

			nodes = el;
			copyCache = cache;
		}

		function getResultAndAdd(chain) {
			result = eval("options.data." + chain);
			nodes.nodeValue = copyCache.nodeValue.replace(brackets[0] + " " + chain + " " + brackets[1], result.toString());
		}

		function create(chain) {
			if(!created) getResultAndAdd(chain);
		}

		function runWatchProp(props) {
			var watchProp = props.split(".");

			watchProp = watchProp[watchProp.length - 1];
			if(options.watch && options.watch[watchProp]) options.watch[watchProp].call(self);
		}

		function changeCheck(chain) {
			var props = chain.split(".");
			var lastProp = props[props.length - 1];
			
			props = props.slice(0,-1).join(".");
			if(eval("options.data." + props + "._" + lastProp + ".change")) {
				eval("options.data." + props + "._" + lastProp + ".change = false");
				return true;
			}
		}
	}

	function propertiesModification(object) {
		cloneProps(object);
		createGetterSetter(object);
		cloneRootproperties(object);

		function cloneProps(object) {
			for(var key in object) {
				if(typeof object[key] == "object") {
					cloneProps(object[key]);
				} else {
					object["_" + key] = { change: false, value: object[key] };
					Object.defineProperty(object, "_" + key, {
						enumerable: false
					})
				}
			}
		}

		function cloneRootproperties(object) {
			for(var key in object) {
				self[key] = object[key]
			}
		}

		function createGetterSetter(object) {
			for(var key in object) {
				if(typeof object[key] == "object") {
					createGetterSetter(object[key]);
				} else {
					(function(key) {
						Object.defineProperty(object, key, {
							get: function() {
								return this["_" + key].value;
							},
							set: function(value) {
								this["_" + key].value = value;
								this["_" + key].change = true;
								render();
							}
						})
					})(key);
				}
			}
		}
	}

	function runComputedProp(object) {
		for(key in object) {
			object[key].call(this);
		}
	}

	function render() {
		replace();
	}

	function init() {
		findNode(cache.childNodes);
		propertiesModification(options.data);
		runComputedProp.call(self, options.computed);
		replace();
		created = true;
	}

	init();
}