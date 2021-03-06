function Watcher(options) {
	var el = document.querySelector(options.el);
	var cache = el.cloneNode(true);
	var brackets = ["{{", "}}"];
	var regexp = new RegExp("(?<=" + brackets[0] + ")(.*)(?=" + brackets[1] + ")");
	var keywords = {
		values: [],
		attrs: []
	};
	var paths = {
		values: [],
		attrs: []
	};
	var self = this;
	var created = false;

	function findNode(nodes) {
		for(var i = 0; i < nodes.length; i++) {
			// find values
			if(nodes[i].childNodes.length) {
				findNode(nodes[i].childNodes);
			} else {
				if(regexp.test(nodes[i].data)) {
					findIndex(nodes[i], nodes, "values")
					keywords.values.push(nodes[i].data.match(regexp)[0].trim());
				}
			}
			// find attrs
			if(nodes[i].attributes && nodes[i].attributes.length) {
				for(var j = 0; j < nodes[i].attributes.length; j++) {
					if(regexp.test(nodes[i].attributes[j].nodeValue)) {
						findIndex(nodes[i], nodes, "attrs");
						keywords.attrs.push(nodes[i].attributes[j].nodeValue.match(regexp)[0].trim());
					}
				}
			}
		}
	}

	function findIndex(node, nodes, pathName) {
		if(!findIndex[pathName]) findIndex[pathName] = {}
			if(!findIndex[pathName].path) findIndex[pathName].path = [];
		if(!findIndex[pathName].index) findIndex[pathName].index = 0;

		for(var i = 0; i < nodes.length; i++) {
			if(node == nodes[i]) {
				findIndex[pathName].path.push(i);

				if(nodes[i].parentNode.parentNode) {
					findIndex(node.parentNode, nodes[i].parentNode.parentNode.childNodes, pathName)
				} else {
					paths[pathName][findIndex[pathName].index] = findIndex[pathName].path.reverse();
					findIndex[pathName].path = [];
					findIndex[pathName].index++;
				}
			}
		}
	}

	function replace(item) {
		var nodes = el;
		var copyCache = cache;
		var chain;
		var result;

		function replaceValue(item) {
			nodes = el;
			copyCache = cache;

			for(var i = 0; i < paths.values.length; i++) {
				for(var j = 0; j < paths.values[i].length; j++) {
					nodes = nodes.childNodes[paths.values[i][j]];
					copyCache = copyCache.childNodes[paths.values[i][j]];
				}
				chain = copyCache.nodeValue.match(regexp)[0].trim();

				if(created) {
					if(changeCheck(keywords.values[i])) { 
						getResultAndAdd(keywords.values[i]);
						replaceAttrs(keywords.values[i])
						replaceValue(keywords.values[i]);
					}
					if(item && keywords.values[i] == item) {
						getResultAndAdd(keywords.values[i]);
					}
				} else {
					create(keywords.values[i]);
				}

				nodes = el;
				copyCache = cache;
			}
		}

		function replaceAttrs(item) {
			nodes = el;
			copyCache = cache;

			for(var i = 0; i < paths.attrs.length; i++) {
				for(var j = 0; j < paths.attrs[i].length; j++) {
					nodes = nodes.childNodes[paths.attrs[i][j]];
					copyCache = copyCache.childNodes[paths.attrs[i][j]];
				}

				for(var k = 0; k < copyCache.attributes.length; k++) {
					if(regexp.test(copyCache.attributes[k].nodeValue)) {
						chain = copyCache.attributes[k].nodeValue.match(regexp)[0].trim();
						
						if(created) {
							// Если нет на странице а только в атрибуте
							if(changeCheck(keywords.attrs[i])) {
								getResultAndAdd(keywords.attrs[i], copyCache.attributes[k]);
							}
							// Если есть на станице и меняется свойство
							if(item && keywords.attrs[i] == item && chain == item) {
								getResultAndAdd(chain, copyCache.attributes[k])
							}
						} else {
							create(chain, copyCache.attributes[k]);
						}
					}
				}

				nodes = el;
				copyCache = cache;
			}
		}

		function getResultAndAdd(chain, attr) {
			result = eval("options.data." + chain);

			if(attr) {
				result = attr.nodeValue.replace(brackets[0] + " " + chain + " " + brackets[1], result.toString());

				switch(attr.nodeName) {
					case "styles":
						nodes.style.cssText += result;
						nodes.removeAttribute("styles");
						break;
					default:
						nodes[attr.nodeName] = result;
						nodes.setAttribute(attr.nodeName, result);

				}
			} else {
				nodes.nodeValue = copyCache.nodeValue.replace(brackets[0] + " " + chain + " " + brackets[1], result.toString());
			}
		}

		function create() {
			if(!created) getResultAndAdd.apply(null, arguments);
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

		function replaceInit() {
			replaceValue();
			replaceAttrs();
		}

		replaceInit();
	}

	function watchProp(prop) {
		if(options.watch && options.watch[prop]) options.watch[prop].call(self);
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
								watchProp(key);
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