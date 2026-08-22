import { APIInvite, GuildFeature, RouteBases } from "discord-api-types/v10"

import { SVG, registerWindow } from '@svgdotjs/svg.js'
import * as opentype from 'opentype.js'
import { strings } from './strings'
import { INVITE_WIDTH, INVITE_HEIGHT, PADDING, HEADER_LINE_HEIGHT, HEADER_FONT_SIZE, HEADER_MARGIN_BOTTOM, ICON_SIZE, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_MARGIN_LEFT, SERVER_NAME_LINE_HEIGHT, SERVER_NAME_MARGIN_BOTTOM, PRESENCE_LINE_HEIGHT, BADGE_MARGIN_RIGHT, SERVER_NAME_SIZE, PRESENCE_DOT_SIZE, PRESENCE_FONT_SIZE, PRESENCE_DOT_MARGIN_RIGHT, PRESENCE_TEXT_MARGIN_RIGHT, HUB_ICON, SPECIAL_BADGE, PARTNER_ICON, VERIFIED_ICON, COMMON_COLORS, THEMES, WHITNEY_BOLD_URL, WHITNEY_MEDIUM_URL, WHITNEY_SEMIBOLD_URL } from "./constants"
import { parseHTML } from "linkedom/worker"

let whitneyBold: opentype.Font | undefined
let whitneySemibold: opentype.Font | undefined
let whitneyMedium: opentype.Font | undefined

const loadFont = async (url: string) => {
	const res = await fetch(url)
	if (!res.ok) {
		throw new Error(`Failed to load font ${url}: ${res.status} ${res.statusText}`)
	}
	return opentype.parse(await res.arrayBuffer())
}

const loadFonts = async () => {
	const [bold, semibold, medium] = await Promise.all([
		whitneyBold ? Promise.resolve(whitneyBold) : loadFont(WHITNEY_BOLD_URL).then(font => whitneyBold = font),
		whitneySemibold ? Promise.resolve(whitneySemibold) : loadFont(WHITNEY_SEMIBOLD_URL).then(font => whitneySemibold = font),
		whitneyMedium ? Promise.resolve(whitneyMedium) : loadFont(WHITNEY_MEDIUM_URL).then(font => whitneyMedium = font)
	])
	return { bold, semibold, medium }
}

const textPath = (font: opentype.Font, text: string, options: opentype.RenderOptions & { anchor?: string, fontSize?: number, x?: number, y?: number } = {}) => {
	const fontSize = options.fontSize ?? 72
	const renderOptions = {
		kerning: options.kerning ?? true,
		letterSpacing: options.letterSpacing,
		tracking: options.tracking
	}
	const fontScale = fontSize / font.unitsPerEm
	const width = font.getAdvanceWidth(text, fontSize, renderOptions)
	const height = (font.ascender - font.descender) * fontScale
	const ascender = font.ascender * fontScale
	const horizontalAnchor = options.anchor?.match(/left|center|right/i)?.[0].toLowerCase() ?? 'left'
	const verticalAnchor = options.anchor?.match(/baseline|top|bottom|middle/i)?.[0].toLowerCase() ?? 'baseline'

	let x = options.x ?? 0
	if (horizontalAnchor === 'center') x -= width / 2
	if (horizontalAnchor === 'right') x -= width

	let y = options.y ?? 0
	if (verticalAnchor === 'baseline') y -= ascender
	if (verticalAnchor === 'middle') y -= height / 2
	if (verticalAnchor === 'bottom') y -= height

	return {
		d: font.getPath(text, x, y + ascender, fontSize, renderOptions).toPathData(2),
		width,
		height
	}
}

// Old green color: #43b581


export const render = async (inviteCode: string, { language = 'en', animation = true, theme = 'dark' }: { language?: keyof typeof strings, animation?: boolean, theme?: keyof typeof THEMES }): Promise<{ success: true, data: string } | { success: false, code: number }> => {
	try {
		const inviteReq = await fetch(`${RouteBases.api}/invites/${inviteCode}?with_counts=true`)
		// console.log(JSON.stringify(await inviteReq.clone().json()))
		const invite = (await inviteReq.json().catch(() => undefined)) as unknown as APIInvite | undefined
		if (!inviteReq.ok || !invite || !invite.guild) {
			if (inviteReq.status === 429) {
				console.log(`Ratelimited for invite code ${inviteCode}`)
				return { success: false, code: 429 }
			}
			console.log(`No guild for invite code ${inviteCode} - ${inviteReq.status}`)
			return { success: false, code: 404 }
		}
		const locale = strings[language] || strings.en
		const { bold, semibold, medium } = await loadFonts()

		const { document, window } = parseHTML('<!doctype html><html><body></body></html>')
		registerWindow(window, document)
		const canvas = SVG().addTo(document.body)
		canvas.viewbox(0, 0, INVITE_WIDTH, INVITE_HEIGHT).width(INVITE_WIDTH).height(INVITE_HEIGHT)

		const themeColors = {
			...COMMON_COLORS,
			...(THEMES[theme] || THEMES.dark)
		}

		// Background
		canvas.rect(INVITE_WIDTH, INVITE_HEIGHT).radius(3).fill(themeColors.background)

		// Main Container
		const mainContainer = canvas.nested()
			.width(INVITE_WIDTH - 2 * PADDING)
			.height(INVITE_HEIGHT - 2 * PADDING)
			.move(PADDING, PADDING)

		// Header
		const headerContainer = mainContainer.nested().width(INVITE_WIDTH - 2 * PADDING).height(HEADER_LINE_HEIGHT)
		const headerText = textPath(bold, (invite.guild.features.includes(GuildFeature.Hub) ? locale.header_hub : locale.header).toUpperCase(), { anchor: 'left top', fontSize: HEADER_FONT_SIZE })
		headerContainer.path(headerText.d).fill(themeColors.header)

		// Content Container
		const contentContainer = mainContainer.nested()
			.width(INVITE_WIDTH - 2 * PADDING)
			.height(INVITE_HEIGHT - 2 * PADDING - HEADER_LINE_HEIGHT - HEADER_MARGIN_BOTTOM)
			.move(0, HEADER_LINE_HEIGHT + HEADER_MARGIN_BOTTOM)

		// Server Icon
		const squircle = contentContainer.rect(ICON_SIZE, ICON_SIZE).radius(16).fill(themeColors.serverIcon)
		if (invite.guild.icon) {
			const isAnimated = invite.guild.icon.startsWith('a_')
			const ext = (isAnimated && animation) ? 'gif' : 'webp'
			const iconUrl = `${RouteBases.cdn}/icons/${invite.guild.id}/${invite.guild.icon}.${ext}`

			const res = await fetch(iconUrl)
			const iconBase64 = Buffer.from(await res.arrayBuffer()).toString('base64')

			const iconImage = contentContainer
				.image(`data:image/${ext};base64,${iconBase64}`)
				.size(ICON_SIZE, ICON_SIZE)

			iconImage.clipWith(squircle)
		}

		// Join button
		const buttonContainer = contentContainer.nested()
			.width(BUTTON_WIDTH)
			.height(BUTTON_HEIGHT)
			.move(INVITE_WIDTH - 2 * PADDING - BUTTON_WIDTH, (INVITE_HEIGHT - 2 * PADDING - HEADER_LINE_HEIGHT - HEADER_MARGIN_BOTTOM - BUTTON_HEIGHT) / 2)
			.linkTo(link => {
				link.to(`https://discord.gg/${inviteCode}`).target('_blank')
			})
		buttonContainer.rect(BUTTON_WIDTH, BUTTON_HEIGHT)
			.radius(3)
			.fill(themeColors.joinButtonBackground)
		const joinButton = textPath(medium, locale.button, { fontSize: 14 })
		const joinButtonText = textPath(medium, locale.button, { anchor: 'left top', fontSize: 14, x: (BUTTON_WIDTH - joinButton.width) / 2, y: (BUTTON_HEIGHT - joinButton.height) / 2 })
		buttonContainer.path(joinButtonText.d)
			.fill(themeColors.joinButtonText)

		let EXTRA_SERVER_NAME_PADDING = 0

		const innerContainer = contentContainer.nested()
			.width(INVITE_WIDTH - 2 * PADDING - ICON_SIZE - PADDING - BUTTON_WIDTH - BUTTON_MARGIN_LEFT)
			.height(SERVER_NAME_LINE_HEIGHT + SERVER_NAME_MARGIN_BOTTOM + PRESENCE_LINE_HEIGHT)
			.x(ICON_SIZE + PADDING)
		innerContainer.y((INVITE_HEIGHT - 2 * PADDING - HEADER_LINE_HEIGHT - HEADER_MARGIN_BOTTOM - SERVER_NAME_LINE_HEIGHT - SERVER_NAME_MARGIN_BOTTOM - PRESENCE_LINE_HEIGHT) / 2)

		const badgeContainer = innerContainer.nested().y(2)

		// Feature Badges
		if (invite.guild.features.includes(GuildFeature.Verified) && invite.guild.features.includes(GuildFeature.Hub)) {
			const circle = badgeContainer
				.circle(16)
				.fill(themeColors.badges.VERIFIED.flowerStar)
			for (const path of HUB_ICON) { badgeContainer.path(path).fill(themeColors.badges.VERIFIED.icon) }
			EXTRA_SERVER_NAME_PADDING = 16 + BADGE_MARGIN_RIGHT
		} else if (invite.guild.features.includes(GuildFeature.Verified)) {
			badgeContainer
				.path(SPECIAL_BADGE)
				.fill(themeColors.badges.VERIFIED.flowerStar)
			badgeContainer
				.path(VERIFIED_ICON)
				.fill(themeColors.badges.VERIFIED.icon)
			EXTRA_SERVER_NAME_PADDING = 16 + BADGE_MARGIN_RIGHT
		} else if (invite.guild.features.includes(GuildFeature.Partnered)) {
			badgeContainer
				.path(SPECIAL_BADGE)
				.fill(themeColors.badges.PARTNERED.flowerStar)
			badgeContainer
				.path(PARTNER_ICON)
				.fill(themeColors.badges.PARTNERED.icon)
			EXTRA_SERVER_NAME_PADDING = 16 + BADGE_MARGIN_RIGHT
		}

		// Server Name
		const serverName = textPath(semibold, invite.guild.name, { anchor: 'left top', fontSize: SERVER_NAME_SIZE })
		const serverNameText = textPath(semibold, invite.guild.name, { anchor: 'left top', fontSize: SERVER_NAME_SIZE, x: EXTRA_SERVER_NAME_PADDING, y: (SERVER_NAME_LINE_HEIGHT - serverName.height) / 2 })
		innerContainer.path(serverNameText.d)
			.fill(themeColors.serverName)

		const presenceContainer = innerContainer.nested()
			.height(PRESENCE_LINE_HEIGHT)
			.width(INVITE_WIDTH - 2 * PADDING - ICON_SIZE - PADDING - BUTTON_WIDTH - BUTTON_MARGIN_LEFT)
			.y(SERVER_NAME_LINE_HEIGHT + SERVER_NAME_MARGIN_BOTTOM)

		// Online and member counts
		presenceContainer.circle(PRESENCE_DOT_SIZE)
			.fill(themeColors.online)
			.y((PRESENCE_LINE_HEIGHT - PRESENCE_DOT_SIZE) / 2)
		const onlineTextValue = locale.online.replace('{{count}}', (invite.approximate_presence_count ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','))
		const presenceText = textPath(semibold, onlineTextValue, { fontSize: PRESENCE_FONT_SIZE })
		const presencePath = textPath(semibold, onlineTextValue, { anchor: 'left top', fontSize: PRESENCE_FONT_SIZE, x: PRESENCE_DOT_SIZE + PRESENCE_DOT_MARGIN_RIGHT, y: (PRESENCE_LINE_HEIGHT - presenceText.height) / 2 })
		presenceContainer.path(presencePath.d)
			.fill(themeColors.presenceText)
		presenceContainer.circle(PRESENCE_DOT_SIZE)
			.fill(themeColors.members)
			.y((PRESENCE_LINE_HEIGHT - PRESENCE_DOT_SIZE) / 2)
			.x(PRESENCE_DOT_SIZE + PRESENCE_DOT_MARGIN_RIGHT + presenceText.width + PRESENCE_TEXT_MARGIN_RIGHT)
		const membersTextValue = locale.members.replace('{{count}}', (invite.approximate_member_count ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','))
		const membersText = textPath(semibold, membersTextValue, { fontSize: PRESENCE_FONT_SIZE })
		const membersPath = textPath(semibold, membersTextValue, { anchor: 'left top', fontSize: PRESENCE_FONT_SIZE, x: PRESENCE_DOT_SIZE + PRESENCE_DOT_MARGIN_RIGHT + presenceText.width + PRESENCE_TEXT_MARGIN_RIGHT + PRESENCE_DOT_SIZE + PRESENCE_DOT_MARGIN_RIGHT, y: (PRESENCE_LINE_HEIGHT - membersText.height) / 2 })
		presenceContainer.path(membersPath.d)
			.fill(themeColors.presenceText)

		return { success: true, data: canvas.svg() }
	} catch (e) {
		console.error(e)
		return { success: false, code: 500 }
	}
}
