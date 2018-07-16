"use strict";

const $ = require("jquery");
const templates = require("../views");
const options = require("./options");
const renderPreview = require("./renderPreview");
const utils = require("./utils");
const constants = require("./constants");
const condensed = require("./condensed");
const JoinChannel = require("./join-channel");
const storage = require("./localStorage");
const {vueApp} = require("./vue");
const sidebar = $("#sidebar");

module.exports = {
	renderNetworks,
	trimMessageInChannel,
};

function appendMessage(container, chanId, chanType, msg) {
	if (utils.lastMessageId < msg.id) {
		utils.lastMessageId = msg.id;
	}

	return;

	let lastChild = container.children(".msg, .date-marker-container").last();
	const renderedMessage = buildChatMessage(msg);

	// Check if date changed
	const msgTime = new Date(msg.time);
	const prevMsgTime = new Date(lastChild.data("time"));

	// Insert date marker if date changed compared to previous message
	if (prevMsgTime.toDateString() !== msgTime.toDateString()) {
		lastChild = $(templates.date_marker({time: msg.time}));
		container.append(lastChild);
	}

	// If current window is not a channel or this message is not condensable,
	// then just append the message to container and be done with it
	if (msg.self || msg.highlight || constants.condensedTypes.indexOf(msg.type) === -1 || chanType !== "channel") {
		container.append(renderedMessage);
		return;
	}

	const obj = {};
	obj[msg.type] = 1;

	// If the previous message is already condensed,
	// we just append to it and update text
	if (lastChild.hasClass("condensed")) {
		lastChild.append(renderedMessage);
		condensed.updateText(lastChild, obj);
		return;
	}

	// Always create a condensed container
	const newCondensed = $(templates.msg_condensed({time: msg.time}));

	condensed.updateText(newCondensed, obj);
	newCondensed.append(renderedMessage);
	container.append(newCondensed);
}

function buildChatMessage(msg) {
	const type = msg.type;
	let template = "msg";

	// See if any of the custom highlight regexes match
	if (!msg.highlight && !msg.self
		&& options.highlightsRE
		&& (type === "message" || type === "notice")
		&& options.highlightsRE.exec(msg.text)) {
		msg.highlight = true;
	}

	if (typeof templates.actions[type] !== "undefined") {
		template = "msg_action";
	} else if (type === "unhandled") {
		template = "msg_unhandled";
	}

	// Make the MOTDs a little nicer if possible
	if (msg.type === "motd") {
		let lines = msg.text.split("\n");

		// If all non-empty lines of the MOTD start with a hyphen (which is common
		// across MOTDs), remove all the leading hyphens.
		if (lines.every((line) => line === "" || line[0] === "-")) {
			lines = lines.map((line) => line.substr(2));
		}

		// Remove empty lines around the MOTD (but not within it)
		msg.text = lines.join("\n").trim();
	}

	const renderedMessage = $(templates[template](msg));
	const content = renderedMessage.find(".content");

	if (template === "msg_action") {
		content.html(templates.actions[type](msg));
	}

	msg.previews.forEach((preview) => {
		renderPreview(preview, renderedMessage);
	});

	return renderedMessage;
}

function renderNetworks(data, singleNetwork) {
	const collapsed = new Set(JSON.parse(storage.get("thelounge.networks.collapsed")));

	// Add keyboard handlers to the "Join a channel…" form inputs/button
	JoinChannel.handleKeybinds(data.networks);

	let newChannels;
	const channels = $.map(data.networks, function(n) {
		if (collapsed.has(n.uuid)) {
			collapseNetwork($(`.network[data-uuid="${n.uuid}"] button.collapse-network`));
		}

		return n.channels;
	});

	if (!singleNetwork && utils.lastMessageId > -1) {
		newChannels = [];

		channels.forEach((channel) => {
			const chan = $("#chan-" + channel.id);

			if (chan.length > 0) {
				if (channel.type === "channel") {
					channel.usersOutdated = true;
				}

				if (channel.messages.length > 0) {
					const container = chan.find(".messages");

					if (container.find(".msg").length >= 100) {
						container.find(".show-more").addClass("show");
					}

					container.parent().trigger("keepToBottom");
				}
			} else {
				newChannels.push(channel);
			}
		});
	} else {
		newChannels = channels;
	}

	if (newChannels.length > 0) {
		newChannels.forEach((channel) => {
			if (channel.type === "channel") {
				channel.usersOutdated = true;
			}
		});
	}

	utils.confirmExit();

	for (const network of vueApp.networks) {
		for (const channel of network.channels) {
			if (channel.highlight > 0) {
				utils.updateTitle();
				utils.toggleNotificationMarkers(true);
				return;
			}
		}
	}
}

function trimMessageInChannel(channel, messageLimit) {
	const messages = channel.find(".messages .msg").slice(0, -messageLimit);

	if (messages.length === 0) {
		return;
	}

	messages.remove();

	channel.find(".show-more").addClass("show");

	// Remove date-separators that would otherwise be "stuck" at the top of the channel
	channel.find(".date-marker-container").each(function() {
		if ($(this).next().hasClass("date-marker-container")) {
			$(this).remove();
		}
	});
}

sidebar.on("click", "button.collapse-network", (e) => collapseNetwork($(e.target)));

function collapseNetwork(target) {
	const collapseButton = target.closest(".collapse-network");
	const networks = new Set(JSON.parse(storage.get("thelounge.networks.collapsed")));
	const networkuuid = collapseButton.closest(".network").data("uuid");

	if (collapseButton.closest(".network").find(".active").length > 0) {
		collapseButton.closest(".lobby").trigger("click", {
			keepSidebarOpen: true,
		});
	}

	collapseButton.closest(".network").toggleClass("collapsed");

	if (collapseButton.attr("aria-expanded") === "true") {
		collapseButton.attr("aria-expanded", false);
		collapseButton.attr("aria-label", "Expand");
		networks.add(networkuuid);
	} else {
		collapseButton.attr("aria-expanded", true);
		collapseButton.attr("aria-label", "Collapse");
		networks.delete(networkuuid);
	}

	storage.set("thelounge.networks.collapsed", JSON.stringify([...networks]));
	return false;
}
