# Connecting a language model

Without a language model, the chat answers from a script and has no message box. To connect one, install Micah Wood's [Agentic Editor](https://github.com/wpscholar/agentic-editor) plugin and set up an AI connector under Settings > Connectors. The message box then shows, and what people type goes to the model through Agentic Editor's chat endpoint. The chat's own choices are still answered from the script.

The chat prefers OpenAI's `gpt-6-luna`, a small, cheap model, and falls back to Agentic Editor's choice when the site's connectors don't offer it. The `create-not-learn-editor_assistant_model_preference` filter changes the list. It only applies to this editor's chat.

The model gets two kinds of tool. Ours, in `src/chat/model-tools.js`, show the same pickers the script does, so people still make each change by picking. Agentic Editor's block editor tools change the page on the canvas. Asked to edit the header or footer without saying what, the chat lists what its screen offers, its layout, the site's name and logo, the menu and the social links, each leading to its picker (`src/chat/extras/site-part-widgets.jsx`). The header and footer stay locked on a page until someone chooses Edit header or Edit footer, so to change their words, links or social links the model first opens one the same way, in the spotlight, with `cnl_open_site_part` (`src/chat/site-parts.js`).

Some requests only ask for a picker, like "change my colours", and the model could do no more than show it. With a [TypeSafe](https://docs.typesafe.ai/introduction) API key under Settings > Connectors, those skip the model (`src/chat/router.js`). TypeSafe's Jev model doesn't write. It picks which picker a message asks for, and says how confident it is, in well under a second. Each picker is described to it with what it doesn't cover, so "edit my menu" gets the menu picker and "add a mobile menu" goes to the language model.

The script's keyword matching isn't used for what is typed while a language model is connected, as it can't tell those apart. Without TypeSafe, everything typed goes to the language model.

Jev is also shown the site's pages and the sections of the page that is open, so a request like "the testimonial looks too pale" or "the photos bit on my Workshops page" goes straight to that section's picker. For a section on a page that isn't open, the chat asks Jev again once it knows the page, with that page's sections.

When Jev picks a picker with a confidence of 0.8 or more, the chat shows it. Anything else goes on to the language model. The `create-not-learn-editor_assistant_router_confidence` and `create-not-learn-editor_assistant_router_model` filters change the threshold and the model.

TypeSafe is a connector of its own rather than an AI provider, as it doesn't generate text. The key can also come from a `TYPESAFE_API_KEY` environment variable or constant. The editor asks Jev through `POST /wp-json/create-not-learn-editor/v1/assistant/route`, so the key stays on the server (`includes/assistant-router.php`).

Asked for a page or section about something, the model writes one. It rewrites the words of one of the theme's designs, and the chat shows the result first in the page or section picker, to pick like any other design (`src/chat/written-designs.js`). The same works on a design already picked in the chat, as in "make this about sock puppets".

The chat often sits beside a page, so a change to the whole site can look like a change to that page. Pickers that change every page, like colors, fonts, the menu, the header and the footer, carry the editor's purple globe note, and the model is told to say which pages a change shows on before making it (`src/chat/scope.js`). Pickers that change one page name it instead, as the editor leaves what is local unmarked.

Agentic Editor asks before running some of its tools, such as publishing a pattern. This chat has nowhere to ask yet, so it leaves those out, and it won't run a call that adds raw HTML or scripts.

The editor loads Agentic Editor's tools with `agentic_editor_enqueue_abilities()`, which [wpscholar/agentic-editor#30](https://github.com/wpscholar/agentic-editor/pull/30) adds. Until that is merged, map the PR's branch into `wp-env` with a `.wp-env.override.json`, as [CONTRIBUTING.md](../CONTRIBUTING.md#trying-another-plugin-alongside-the-editor) describes.
