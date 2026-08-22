import { render } from "./renderer";

export default {
	async fetch(req): Promise<Response> {
		const url = new URL(req.url)

		switch (url.pathname) {
			case "/":
				return Response.redirect("https://www.buape.com?utm_source=invidget&utm_medium=redirect")
			default:
				if (url.pathname.includes("/", 1)) {
					return new Response(null, { status: 404 })
				} else {
					const invite = url.pathname.replace("/", "")
					if (!invite.match(/^[a-zA-Z0-9\-]{2,32}$/)) return new Response(null, { status: 404 })
					const keys = ["language", "animation", "theme"] as const;
					const options = Object.fromEntries(
						keys
							.map((key) => [key, url.searchParams.get(key)])
							.filter(([, val]) => val !== null)
					) as Partial<Parameters<typeof render>[1]>
					console.log(`Rendering with ${invite} and ${JSON.stringify(options)}`)
					const image = await render(invite, options)
					if (image.success)
						return new Response(image.data, { headers: { "Content-Type": "image/svg+xml" } })
					else
						return new Response(null, { status: image.code })
				}
		}
	},
} satisfies ExportedHandler<Env>;