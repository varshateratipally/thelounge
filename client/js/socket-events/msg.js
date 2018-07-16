"use strict";

const $ = require("jquery");
const socket = require("../socket");
const render = require("../render");
const utils = require("../utils");
const options = require("../options");
const helpers_roundBadgeNumber = require("../libs/handlebars/roundBadgeNumber");
const cleanIrcMessage = require("../libs/handlebars/ircmessageparser/cleanIrcMessage");
const webpush = require("../webpush");
const chat = $("#chat");
const sidebar = $("#sidebar");
const {vueApp, findChannel} = require("../vue");

let pop;

try {
	pop = new Audio();
	pop.src = "audio/pop.ogg";
} catch (e) {
	pop = {
		play: $.noop,
	};
}

socket.on("msg", function(data) {
	// We set a maximum timeout of 2 seconds so that messages don't take too long to appear.
	utils.requestIdleCallback(() => processReceivedMessage(data), 2000);
});

function processReceivedMessage(data) {
	let targetId = data.chan;
	let target = "#chan-" + targetId;
	let channelContainer = chat.find(target);
	let channel = findChannel(data.chan);

	// Clear unread/highlight counter if self-message
	if (data.msg.self) {
		channel.channel.highlight = 0;
		channel.channel.unread = 0;

		utils.updateTitle();
	}

	// Display received notices and errors in currently active channel.
	// Reloading the page will put them back into the lobby window.
	// We only want to put errors/notices in active channel if they arrive on the same network
	if (data.msg.showInActive && vueApp.activeChannel && vueApp.activeChannel.network === channel.network) {
		channel = vueApp.activeChannel;

		targetId = data.chan = vueApp.activeChannel.channel.id;

		target = "#chan-" + targetId;
		channelContainer = chat.find(target);
	}

	const scrollContainer = channelContainer.find(".chat");
	const container = channelContainer.find(".messages");
	const activeChannelId = chat.find(".chan.active").data("id");

	if (data.msg.type === "channel_list" || data.msg.type === "ban_list" || data.msg.type === "ignore_list") {
		$(container).empty();
	}

	// Add message to the container
	render.appendMessage(
		container,
		targetId,
		channelContainer.data("type"),
		data.msg
	);

	if (activeChannelId === targetId) {
		scrollContainer.trigger("keepToBottom");
	}

	notifyMessage(targetId, channelContainer, data);

	let shouldMoveMarker = data.msg.self;

	if (!shouldMoveMarker) {
		const lastChild = container.children().last();

		// If last element is hidden (e.g. hidden status messages) check the element before it.
		// If it's unread marker or date marker, then move unread marker to the bottom
		// so that it isn't displayed as the last element in chat.
		// display properly is checked instead of using `:hidden` selector because it doesn't work in non-active channels.
		if (lastChild.css("display") === "none") {
			const prevChild = lastChild.prev();

			shouldMoveMarker =
				prevChild.hasClass("unread-marker") ||
				(prevChild.hasClass("date-marker") && prevChild.prev().hasClass("unread-marker"));
		}
	}

	if (shouldMoveMarker) {
		container
			.find(".unread-marker")
			.data("unread-id", 0)
			.appendTo(container);
	}

	let messageLimit = 0;

	if (activeChannelId !== targetId) {
		// If message arrives in non active channel, keep only 100 messages
		messageLimit = 100;
	} else if (scrollContainer.isScrollBottom()) {
		// If message arrives in active channel, keep 500 messages if scroll is currently at the bottom
		messageLimit = 500;
	}

	if (messageLimit > 0) {
		render.trimMessageInChannel(channelContainer, messageLimit);
	}

	if ((data.msg.type === "message" || data.msg.type === "action") && channelContainer.hasClass("channel")) {
		const nicks = channelContainer.find(".userlist").data("nicks");

		if (nicks) {
			const find = nicks.indexOf(data.msg.from.nick);

			if (find !== -1) {
				nicks.splice(find, 1);
				nicks.unshift(data.msg.from.nick);
			}
		}
	}
}

function notifyMessage(targetId, channel, msg) {
	const serverUnread = msg.unread;
	const serverHighlight = msg.highlight;

	msg = msg.msg;

	if (msg.self) {
		return;
	}

	const button = sidebar.find(".chan[data-id='" + targetId + "']");

	if (msg.highlight || (options.settings.notifyAllMessages && msg.type === "message")) {
		if (!document.hasFocus() || !channel.hasClass("active")) {
			if (options.settings.notification) {
				try {
					pop.play();
				} catch (exception) {
					// On mobile, sounds can not be played without user interaction.
				}
			}

			utils.toggleNotificationMarkers(true);

			if (options.settings.desktopNotifications && ("Notification" in window) && Notification.permission === "granted") {
				let title;
				let body;

				if (msg.type === "invite") {
					title = "New channel invite:";
					body = msg.from.nick + " invited you to " + msg.channel;
				} else {
					title = msg.from.nick;

					if (!button.hasClass("query")) {
						title += " (" + button.attr("aria-label").trim() + ")";
					}

					if (msg.type === "message") {
						title += " says:";
					}

					body = cleanIrcMessage(msg.text);
				}

				const timestamp = Date.parse(msg.time);

				try {
					if (webpush.hasServiceWorker) {
						navigator.serviceWorker.ready.then((registration) => {
							registration.active.postMessage({
								type: "notification",
								chanId: targetId,
								timestamp: timestamp,
								title: title,
								body: body,
							});
						});
					} else {
						const notify = new Notification(title, {
							tag: `chan-${targetId}`,
							badge: "img/icon-alerted-black-transparent-bg-72x72px.png",
							icon: "img/icon-alerted-grey-bg-192x192px.png",
							body: body,
							timestamp: timestamp,
						});
						notify.addEventListener("click", function() {
							window.focus();
							button.trigger("click");
							this.close();
						});
					}
				} catch (exception) {
					// `new Notification(...)` is not supported and should be silenced.
				}
			}
		}
	}

	if (!serverUnread || button.hasClass("active")) {
		return;
	}

	const badge = button.find(".badge")
		.attr("data-highlight", serverHighlight)
		.html(helpers_roundBadgeNumber(serverUnread));

	if (msg.highlight) {
		badge.addClass("highlight");

		utils.updateTitle();
	}
}
