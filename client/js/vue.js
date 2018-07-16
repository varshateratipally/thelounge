"use strict";

const Vue = require("vue").default;
const App = require("../components/App.vue").default;
const roundBadgeNumber = require("./libs/handlebars/roundBadgeNumber");
const parse = require("./libs/handlebars/parse");
const tz = require("./libs/handlebars/tz");
const localetime = require("./libs/handlebars/localetime");
const localedate = require("./libs/handlebars/localedate");
const friendlydate = require("./libs/handlebars/friendlydate");
const friendlysize = require("./libs/handlebars/friendlysize");
const colorClass = require("./libs/handlebars/colorClass");

Vue.filter("parse", parse);
Vue.filter("tz", tz);
Vue.filter("localetime", localetime);
Vue.filter("localedate", localedate);
Vue.filter("friendlydate", friendlydate);
Vue.filter("friendlysize", friendlysize);
Vue.filter("colorClass", colorClass);
Vue.filter("roundBadgeNumber", roundBadgeNumber);

const vueApp = new Vue({
	el: "#viewport",
	data: {
		connected: false,
		appName: document.title,
		activeChannel: null,
		networks: [],
		settings: {
			syncSettings: false,
			advanced: false,
			autocomplete: true,
			nickPostfix: "",
			coloredNicks: true,
			desktopNotifications: false,
			highlights: [],
			links: true,
			motd: true,
			notification: true,
			notifyAllMessages: false,
			showSeconds: false,
			statusMessages: "condensed",
			theme: document.getElementById("theme").dataset.serverTheme,
			media: true,
			userStyles: "",
		},
	},
	mounted() {
		Vue.nextTick(() => window.vueMounted());
	},
	render(createElement) {
		return createElement(App, {
			props: this,
		});
	},
});

function findChannel(id) {
	for (const network of vueApp.networks) {
		for (const channel of network.channels) {
			if (channel.id === id) {
				return {network, channel};
			}
		}
	}

	return null;
}

module.exports = {
	vueApp,
	findChannel,
};
