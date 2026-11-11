<img src=".wordpress-org/icon.svg" alt="" width="72" height="72">

# Create Not Learn Editor

Create Not Learn is an experimental WordPress plugin that reimagines the Site Editor around what people want to do, not how WordPress works. The goal is simple. Someone who has never used WordPress should be able to set up their site without needing any help.

It looks like WordPress and behaves like WordPress, because it's built from the same packages and APIs as the editor in Core. It gives us room to try bigger ideas than Core can take on today and test them with real people, so the ones that work can be proposed back to Core.

> [!WARNING]
> Create Not Learn Editor is experimental software. Don't install it on a production website. It changes often, may break without notice and hasn't been through the reviews a released plugin would get. Try it in the Playground demos below, or on a local or staging site you don't mind losing.

## Try it yourself

[![Try the demo in WordPress Playground](https://img.shields.io/badge/Try_the_demo-WordPress_Playground-3858e9?style=for-the-badge&logo=wordpress&logoColor=white)](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/trunk/demos/blueprint.json) [![Try it on a blank site in WordPress Playground](https://img.shields.io/badge/Try_a_blank_site-WordPress_Playground-3858e9?style=for-the-badge&logo=wordpress&logoColor=white)](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/trunk/demos/blueprint-blank.json)

![The Create Not Learn editor, with the Create your site checklist beside a live preview of the Fernhouse demo site](.wordpress-org/screenshot-1.jpg)

Each demo runs the latest build in your browser, with nothing to install.

- [Fernhouse demo site](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/trunk/demos/blueprint.json)
- [Blank site](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/trunk/demos/blueprint-blank.json), with the default theme and no content
- [Fernhouse with a shop](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/trunk/demos/blueprint-shop.json), which takes a minute or two longer to load
- Fernhouse in the [Writing](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/trunk/demos/blueprint.json&url=%2Fwp-admin%2Fadmin.php%3Fpage%3Dcreate-not-learn-editor%26workspace%3Dwriting) or [Builder](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/trunk/demos/blueprint.json&url=%2Fwp-admin%2Fadmin.php%3Fpage%3Dcreate-not-learn-editor%26workspace%3Dbuilder) workspace, or the shop in [Selling](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/trunk/demos/blueprint-shop.json&url=%2Fwp-admin%2Fadmin.php%3Fpage%3Dcreate-not-learn-editor%26workspace%3Dselling)

To install it on a test site, use the zip from the [latest release](https://github.com/Automattic/create-not-learn-editor/releases/latest). It needs WordPress 7.0, PHP 7.4 and Gutenberg 24.0.0 or newer.

## What problems is it trying to solve?

The project has two goals. The first is to make the Site Editor far more approachable the first time someone uses it. The second is to find answers to the hard problems the editor faces today, which include

- finding and editing what's on the homepage
- understanding the difference between pages and templates
- managing menus easily
- finding and editing the parts every page shares, like the header and footer
- building pages from sections instead of individual blocks
- knowing what a change will affect before you make it
- not having to keep moving between the editor and WP Admin
- the pull between WordPress as a blogging platform and WordPress as a page builder
- giving common goals an editing space suited to them
- being ready for editing with AI agents

## Why is this a plugin and not part of Core?

I don't believe we can get to a better editor through small changes alone. We need to take some bigger swings, with room to experiment and test new ideas with real users.

A plugin lets us do that. It's low risk and it can move quickly, using AI-powered engineering. Every idea gets checked with real people. Because it's outside Core, it isn't held back by the processes that rightly govern changes there.

This editor isn't the answer and it isn't finished. It's a vision of where the editor could go next. The ideas that hold up in testing are the ones we'll propose for Core.

The exact route back to Core is still being worked out. I'm [Dave Smith](https://github.com/getdave), a WordPress core committer and long-time contributor, so improving Core is the whole point for me. This is not going to become another editor fork.

### What does "Core Adjacent" mean?

I describe the editor as Core Adjacent. That means it

- uses the WordPress Design System for its components and design
- is built from released `@wordpress/*` packages and WordPress Core APIs, on top of the released Gutenberg plugin, with no fork of Gutenberg
- follows the WordPress way, so it stays backwards compatible, can be switched off safely and never changes your site unless you ask it to

So it should feel familiar to anyone who knows WordPress, while staying easy for someone using it for the first time. [Architecture](docs/architecture.md) explains how that works in practice.

## The principles behind it

### Optimise for new users

The first thing anyone sees should be simple enough for someone meeting WordPress for the first time. WordPress serves a huge range of people, but if it's approachable for a newcomer, we believe it's better for everyone, whatever their experience.

You know this from other products. If something is too complicated to get started with, you give up. That's what WordPress does to a lot of people today, and we want to change it.

### Use the words people use, not WordPress concepts

The current Site Editor puts Templates and Patterns in front of you straight away. This editor leads with what people came to do, in their own words. Those words come from user research at Automattic.

- You edit your header and footer from Home, without going through template parts.
- Menus are called Menus, not Navigation.
- Pages are made of sections, and you click "Add section" rather than inserting a pattern.

The system-level tools are all still there, under Advanced in the sidebar.

### Reveal complexity when it's asked for

An interface that's too complicated the first time you meet it will fail, whatever your experience. So every screen starts simple and shows more power when you ask for it.

Page editing is a good example. You start by working with sections, and the full block tree and block tools are one step deeper in the toolbar. Nothing has been taken away. It just isn't the first thing you see.

That does add some deliberate friction before you reach the full power of the block editor. We think a calmer first experience is worth it.

### One objective, many routes

Our research found that people don't follow one path when they build a website. Some start with the design, some with their content, and some want every page and menu in place before anything else.

So instead of a fixed onboarding flow, the editor gives you several routes to the same place. You can edit your header menu on the canvas, from Pages & menu, from the Menus screen, or from Home, then Header, then Menu.

Blocks aren't always the right tool for every job or every person either. Common tasks get focused, Customizer-like screens instead. In Menus, for example, you add pages, links and dropdowns in a familiar tree rather than adding blocks.

### One default, many modes

WordPress serves bloggers, site builders, shops and much more, and a blogger needs different defaults and tools to someone building a portfolio. Until now the editor has tried to serve all of them with one interface, and it has drifted towards the experienced site builder.

This editor uses workspaces instead. Each one adapts the interface to what someone came to do, not how much they know.

- **Default** is for building a site, which is what most people come to WordPress for.
- **Writing** puts posts and writing first, for bloggers.
- **Selling** puts the shop first, when WooCommerce is active.
- **Builder** puts templates, template parts and patterns up front, for agencies, developers and theme authors who know what they've come to change.
- **Agent** gives the canvas the room while an agent does the work.

None of these is finished. The idea we want to test is that one editor can have several expressions of the same tools, because one interface can't serve everyone equally well.

### Keep public content in the editor

WordPress has long asked people to jump between WP Admin and the editor to manage their content, including posts. That hurts the experience, because your content is a big part of building your website.

So this editor brings everything public into the Site Editor. Posts, pages and other public post types are all under Content.

### Make room for plugins

Plugins are where a lot of WordPress's power comes from, and also where a lot of the clutter in WP Admin comes from. This editor lets plugins register their own screens and routes, which get their own place in the sidebar. Any public post types they register appear under Content.

That gives plugins such as WooCommerce a way to offer the kind of focused experience the current editor can't.

### Show everything, with clear scope

When you edit a page you should see it the way visitors do, with the header and footer in place. So they stay on the canvas while you edit.

That makes it important to say when a change affects the whole site rather than just this page. Changes that reach every page, like the header, footer, menu, colours and fonts, are marked as site-wide.

## Built for an agent-ready WordPress

We're designing this editor for a future where WordPress is fully AI enabled. In that future the editor is a canvas, and your own agent, whether that's Claude Code, ChatGPT or something else, uses it to show its work on your actual website.

Our testing keeps showing two things, though. Even when an agent does most of the work, people still want to make small changes themselves. And there's never one kind of user. Some people will want to chat, some will mix chatting with editing, some will do it all by hand and some can't or won't use AI at all. So the editing tools have to be great on their own.

The editor already has a chat and an Agent workspace to try these ideas. [Connecting a language model](docs/language-model.md) explains how to set them up.

## Contributing

Ideas, bug reports and pull requests are all welcome. If something worked for you, didn't work, or you think we've missed something, [open an issue](https://github.com/Automattic/create-not-learn-editor/issues).

To work on the code, start with [CONTRIBUTING.md](CONTRIBUTING.md). It covers setting up a development copy, building and checking your changes, and links to the [docs](docs/) on how the editor works.
