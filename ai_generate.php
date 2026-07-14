<?php

/*
 * ai_generate.php — with thorough error reporting.
 *
 * Every way this can fail now says EXACTLY what went wrong and how
 * to fix it. Even a PHP crash gets converted into readable JSON
 * instead of a blank page or an HTML error dump.
 */

header("Content-Type: application/json");

// Don't let PHP print HTML errors into our JSON

ini_set("display_errors", "0");
error_reporting(E_ALL);


// Safety net: if PHP dies FATALLY anywhere below, this still runs
// and reports the real error as JSON

register_shutdown_function(function () {

    $e = error_get_last();

    if ($e && in_array($e["type"], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {

        http_response_code(500);

        echo json_encode([
            "error" => "PHP fatal error: " . $e["message"]
                     . " — in " . basename($e["file"]) . " on line " . $e["line"]
        ]);

    }

});


// One helper: report a problem and stop

function fail($message, $code = 500) {

    http_response_code($code);

    echo json_encode(["error" => $message]);

    exit;

}


/* ============================================================
 * Pre-flight checks — each one names its exact problem
 * ============================================================ */

session_start();


if (!file_exists(__DIR__ . "/includes/functions.php")) {

    fail("includes/functions.php was not found. ai_generate.php must sit in the project ROOT (next to home.php), with the includes folder beside it.");

}

require_once __DIR__ . "/includes/functions.php";


if (!isset($_SESSION["user_id"])) {

    fail("Not logged in. Open the site and log in first, then try again.", 401);

}


$configPath = __DIR__ . "/includes/ai_config.php";

if (!file_exists($configPath)) {

    fail("Config file missing: expected it at includes/ai_config.php — exact name, with the underscore, INSIDE the includes folder (next to database.php).");

}

require_once $configPath;


if (!defined("AI_FAKE_MODE")) {

    fail("includes/ai_config.php loaded, but AI_FAKE_MODE is not defined — the file's content is wrong or got mangled. It must contain the line: define(\"AI_FAKE_MODE\", true);");

}

if (!defined("OPENAI_API_KEY")) {

    fail("includes/ai_config.php loaded, but OPENAI_API_KEY is not defined. It must contain the line: define(\"OPENAI_API_KEY\", \"sk-...\");");

}

if (!function_exists("curl_init")) {

    fail("The PHP curl extension is not enabled on this server — it's needed to download images and call OpenAI. In MAMP: open php.ini and make sure the line extension=curl is not commented out, then restart the servers.");

}

if (!AI_FAKE_MODE && str_starts_with(OPENAI_API_KEY, "sk-PASTE")) {

    fail("Real mode is ON (AI_FAKE_MODE = false) but the API key is still the placeholder. Either paste a real key into includes/ai_config.php, or switch back to fake mode with: define(\"AI_FAKE_MODE\", true);");

}


/* ============================================================
 * Generate — any unexpected crash is caught and reported too
 * ============================================================ */

try {

    $result = AI_FAKE_MODE ? generateFake() : generateReal();

    echo json_encode($result);

} catch (Throwable $e) {

    fail("Unexpected PHP exception: " . $e->getMessage()
       . " — in " . basename($e->getFile()) . " on line " . $e->getLine());

}

exit;


/* ============================================================
 * FAKE MODE
 * ============================================================ */

function generateFake() {


    $library = [

        [
            "text"    => "Nothing beats that first sip of coffee while the city is still waking up. ☕ Small rituals, big difference — what's the one habit that starts your day right?",
            "tags"    => ["#coffee", "#morningritual", "#slowliving"],
            "keyword" => "coffee"
        ],

        [
            "text"    => "Caught this sunset completely by accident — took the long way home and the sky decided to show off. 🌅 Sometimes the best plan is no plan.",
            "tags"    => ["#sunset", "#nofilter", "#wanderlust"],
            "keyword" => "sunset"
        ],

        [
            "text"    => "Three hours debugging. The fix? One missing underscore. 💻 Programming is 10% writing code and 90% wondering why it doesn't work — and honestly, I love it anyway.",
            "tags"    => ["#coding", "#developerlife", "#php"],
            "keyword" => "computer"
        ],

        [
            "text"    => "Week 6 of morning runs and today the 5K finally felt easy. 🏃 Progress is invisible day to day and undeniable month to month. Keep showing up.",
            "tags"    => ["#running", "#fitnessjourney", "#consistency"],
            "keyword" => "running"
        ],

        [
            "text"    => "Tried making homemade pasta for the first time — flour everywhere, kitchen destroyed, absolutely worth it. 🍝 10/10 will make a mess again.",
            "tags"    => ["#homecooking", "#pastalover", "#foodie"],
            "keyword" => "pasta"
        ],

        [
            "text"    => "That feeling when the playlist hits exactly right and the whole commute becomes a movie scene. 🎧 Music really is free time travel.",
            "tags"    => ["#music", "#playlist", "#goodvibes"],
            "keyword" => "music"
        ]

    ];


    $post = $library[array_rand($library)];


    usleep(800000);


    // The photo is best-effort: if the image site is unreachable,
    // the post still works — and we SAY why the photo is missing.

    $imageError = null;

    $image = fetchImageAsDataUrl(
        "https://loremflickr.com/800/600/" . urlencode($post["keyword"]),
        $imageError
    );


    $result = [
        "content" => $post["text"] . "\n\n" . implode(" ", $post["tags"]),
        "image"   => $image
    ];


    if ($image === null && $imageError !== null) {

        // Not fatal — shows in the browser console, not as an alert

        $result["warning"] = "Post generated, but the photo could not be downloaded: " . $imageError;

    }


    return $result;

}


// Download an image and encode it as a data URL.
// On failure: returns null and puts the REASON into $error.

function fetchImageAsDataUrl($url, &$error = null) {

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 20
    ]);

    $bytes     = curl_exec($ch);
    $curlError = curl_error($ch);
    $code      = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);


    if ($bytes === false) {

        $error = "network problem (" . $curlError . ")";

        return null;

    }

    if ($code !== 200) {

        $error = "the image site answered with HTTP " . $code;

        return null;

    }

    return "data:image/jpeg;base64," . base64_encode($bytes);

}


/* ============================================================
 * REAL MODE — OpenAI, with detailed failure reasons
 * ============================================================ */

function generateReal() {


    // ---- Call 1: GPT writes the post ----

    $chat = openaiRequest("https://api.openai.com/v1/chat/completions", [

        "model" => "gpt-4o-mini",

        "messages" => [
            [
                "role"    => "system",
                "content" => "You write engaging social media posts. Respond ONLY with JSON: " .
                             '{"text": "the post, 2-3 sentences, one fitting emoji", ' .
                             '"tags": ["#three", "#relevant", "#hashtags"], ' .
                             '"image_prompt": "a short description of a photo matching the post"}'
            ],
            [
                "role"    => "user",
                "content" => "Write a post about a currently popular, feel-good topic. Pick the topic yourself."
            ]
        ],

        "response_format" => ["type" => "json_object"]

    ]);


    if (isset($chat["error"])) {
        return ["error" => "OpenAI (text step) failed: " . $chat["error"]];
    }


    $post = json_decode($chat["choices"][0]["message"]["content"] ?? "", true);


    if (!$post || empty($post["text"])) {
        return ["error" => "OpenAI answered, but not in the expected JSON format. Raw answer started with: "
                         . mb_substr($chat["choices"][0]["message"]["content"] ?? "(empty)", 0, 120)];
    }


    // ---- Call 2: DALL·E paints the photo (best-effort) ----

    $imageDataUrl = null;
    $imageWarning = null;

    $image = openaiRequest("https://api.openai.com/v1/images/generations", [

        "model"           => "dall-e-3",
        "prompt"          => "A realistic social media photo: " . ($post["image_prompt"] ?? $post["text"]),
        "size"            => "1024x1024",
        "response_format" => "b64_json"

    ]);


    if (isset($image["error"])) {

        $imageWarning = "Text generated, but the image step failed: " . $image["error"];

    }

    elseif (!empty($image["data"][0]["b64_json"])) {

        $imageDataUrl = "data:image/png;base64," . $image["data"][0]["b64_json"];

    }


    $tags = is_array($post["tags"] ?? null) ? implode(" ", $post["tags"]) : "";


    $result = [
        "content" => trim($post["text"] . "\n\n" . $tags),
        "image"   => $imageDataUrl
    ];

    if ($imageWarning) {
        $result["warning"] = $imageWarning;
    }

    return $result;

}


// One helper for every OpenAI call — reports WHICH way it failed:
// network unreachable, HTTP status, or OpenAI's own error message.

function openaiRequest($url, $payload) {

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_TIMEOUT        => 90,
        CURLOPT_HTTPHEADER     => [
            "Content-Type: application/json",
            "Authorization: Bearer " . OPENAI_API_KEY
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload)
    ]);

    $response  = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);


    if ($response === false) {

        return ["error" => "could not reach api.openai.com — network problem (" . $curlError . "). Is the internet connection working?"];

    }


    $data = json_decode($response, true);


    // OpenAI's own error message is the most useful thing we can show:
    // it says things like "Incorrect API key provided" or
    // "You exceeded your current quota" in plain words.

    if (isset($data["error"]["message"])) {

        return ["error" => "HTTP " . $httpCode . " — " . $data["error"]["message"]];

    }

    if ($httpCode >= 400) {

        return ["error" => "HTTP " . $httpCode . " — " . mb_substr($response, 0, 200)];

    }

    if (!is_array($data)) {

        return ["error" => "OpenAI sent back something that isn't JSON: " . mb_substr($response, 0, 200)];

    }

    return $data;

}