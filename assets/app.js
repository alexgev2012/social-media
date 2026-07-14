document.addEventListener("DOMContentLoaded", () => {


    // ============================
    // Helpers
    // ============================

    function escapeHtml(text) {

        const div = document.createElement("div");
        div.textContent = text;

        return div.innerHTML;

    }


    function initials(first, last) {

        return ((first[0] || "") + (last[0] || "")).toUpperCase();

    }


    // Avatar HTML for the current user (image or initials)

    function myAvatarHtml(extraClass) {

        if (typeof CURRENT_USER !== "undefined" && CURRENT_USER.avatar) {

            return `<img class="avatar ${extraClass}" src="${escapeHtml(CURRENT_USER.avatar)}" alt="">`;

        }

        return `<div class="avatar ${extraClass}">${initials(CURRENT_USER.firstname, CURRENT_USER.lastname)}</div>`;

    }



    // ============================
    // Composer (home page only)
    // ============================

    const textarea = document.getElementById("postContent");


    if (textarea) {


        const postBtn = document.getElementById("postBtn");
        const charCount = document.querySelector(".charCount");

        const photoInput = document.getElementById("photoInput");
        const photoPreview = document.querySelector(".photo-preview");
        const previewImg = document.getElementById("previewImg");
        const removePhoto = document.getElementById("removePhoto");

        const videoInput = document.getElementById("videoInput");
        const videoPreview = document.querySelector(".video-preview");
        const previewVideo = document.getElementById("previewVideo");
        const removeVideo = document.getElementById("removeVideo");

        const MAX_VIDEO_MB = 100;


        function updatePostBtn() {

            const hasText = textarea.value.trim() !== "";
            const hasPhoto = photoInput.files.length > 0;
            const hasVideo = videoInput.files.length > 0;

            postBtn.disabled = !hasText && !hasPhoto && !hasVideo;

        }


        function clearPhoto() {

            photoInput.value = "";
            previewImg.src = "";
            photoPreview.hidden = true;

        }


        function clearVideo() {

            videoInput.value = "";

            previewVideo.pause();
            previewVideo.removeAttribute("src");
            previewVideo.load();

            videoPreview.hidden = true;

        }


        textarea.addEventListener("input", () => {

            charCount.textContent = textarea.value.length + " / 1000";

            updatePostBtn();

        });


        // Photo chosen → preview it, and drop any chosen video
        // (one media per post)

        photoInput.addEventListener("change", () => {


            const file = photoInput.files[0];


            if (file) {

                clearVideo();

                previewImg.src = URL.createObjectURL(file);
                photoPreview.hidden = false;

            }


            updatePostBtn();


        });


        // Video chosen → check the size FIRST (friendlier than a failed upload),
        // then preview it and drop any chosen photo

        videoInput.addEventListener("change", () => {


            const file = videoInput.files[0];


            if (file) {


                if (file.size > MAX_VIDEO_MB * 1024 * 1024) {

                    alert("Video is too large (max " + MAX_VIDEO_MB + " MB).");

                    clearVideo();
                    updatePostBtn();

                    return;

                }


                clearPhoto();

                previewVideo.src = URL.createObjectURL(file);
                videoPreview.hidden = false;

            }


            updatePostBtn();


        });


        removePhoto.addEventListener("click", () => {

            clearPhoto();
            updatePostBtn();

        });


        removeVideo.addEventListener("click", () => {

            clearVideo();
            updatePostBtn();

        });


    }



    // ============================
    // Follow buttons (profile + search)
    // ============================

    document.querySelectorAll(".followBtn").forEach((btn) => {


        btn.addEventListener("click", async () => {


            btn.disabled = true;


            try {

                const body = new FormData();
                body.append("user_id", btn.dataset.userId);


                const res = await fetch("follow.php", {
                    method: "POST",
                    body: body
                });

                const data = await res.json();


                if (data.error) {
                    alert(data.error);
                    return;
                }


                btn.classList.toggle("following", data.following);

                btn.textContent = data.following ? "Following" : "Follow";


                // Update follower count on the profile page (if present)

                const counter = document.querySelector(".followerCount");

                if (counter) {
                    counter.textContent = data.followers;
                }


            } catch (err) {

                alert("Something went wrong. Please try again.");

            } finally {

                btn.disabled = false;

            }


        });


    });



    // ============================
    // Per-post actions
    // ============================

    document.querySelectorAll(".post").forEach((post) => {


        const postId = post.dataset.postId;



        // ---- Like ----

        const likeBtn = post.querySelector(".likeBtn");


        likeBtn.addEventListener("click", async () => {


            likeBtn.disabled = true;


            try {

                const body = new FormData();
                body.append("post_id", postId);


                const res = await fetch("like.php", { method: "POST", body });

                const data = await res.json();


                if (data.error) {
                    alert(data.error);
                    return;
                }


                likeBtn.classList.toggle("liked", data.liked);

                likeBtn.querySelector(".heart").textContent = data.liked ? "❤️" : "🤍";

                likeBtn.querySelector(".likeCount").textContent = data.count;


            } catch (err) {

                alert("Something went wrong. Please try again.");

            } finally {

                likeBtn.disabled = false;

            }


        });



        // ---- Show / hide comments ----

        const commentToggle = post.querySelector(".commentToggle");
        const commentsBox = post.querySelector(".comments");


        commentToggle.addEventListener("click", () => {

            commentsBox.hidden = !commentsBox.hidden;

            if (!commentsBox.hidden) {
                commentsBox.querySelector("input").focus();
            }

        });



        // ---- Comments: add, like, reply ----

        function commentHtml(id, content) {

            return `
                <div class="comment" data-comment-id="${id}">

                    ${myAvatarHtml("small")}

                    <div class="comment-main">

                        <div class="comment-body">
                            <strong>${escapeHtml(CURRENT_USER.firstname + " " + CURRENT_USER.lastname)}</strong>
                            <p>${escapeHtml(content)}</p>
                        </div>

                        <div class="comment-actions">
                            <button class="cLikeBtn"><span class="cHeart">🤍</span> <span class="cLikeCount">0</span></button>
                            <button class="replyBtn">Reply</button>
                            <span class="comment-time">just now</span>
                        </div>

                        <div class="replies"></div>

                        <form class="reply-form" hidden>
                            <input type="text" placeholder="Write a reply..." maxlength="500" autocomplete="off">
                            <button type="submit" class="submitBtn small">Send</button>
                        </form>

                    </div>

                </div>`;

        }


        async function submitComment(content, parentId, targetList, input) {

            try {

                const body = new FormData();
                body.append("post_id", postId);
                body.append("content", content);

                if (parentId) {
                    body.append("parent_id", parentId);
                }


                const res = await fetch("comment.php", { method: "POST", body });

                const data = await res.json();


                if (data.error) {
                    alert(data.error);
                    return;
                }


                targetList.insertAdjacentHTML("beforeend", commentHtml(data.id, data.content));


                const counter = post.querySelector(".commentCount");

                counter.textContent = parseInt(counter.textContent) + 1;


                input.value = "";


            } catch (err) {

                alert("Something went wrong. Please try again.");

            }

        }


        // Top-level comment form

        const commentForm = post.querySelector(".comment-form");


        commentForm.addEventListener("submit", (e) => {

            e.preventDefault();

            const input = commentForm.querySelector("input");
            const content = input.value.trim();

            if (content === "") return;

            submitComment(content, null, post.querySelector(".comment-list"), input);

        });


        // Comment likes + reply buttons: DELEGATED on the post,
        // so they also work for comments added after page load

        post.addEventListener("click", async (e) => {


            // ❤️ on a comment

            const likeB = e.target.closest(".cLikeBtn");

            if (likeB) {


                const commentEl = likeB.closest(".comment");

                likeB.disabled = true;


                try {

                    const body = new FormData();
                    body.append("comment_id", commentEl.dataset.commentId);


                    const res = await fetch("comment_like.php", { method: "POST", body });

                    const data = await res.json();


                    if (data.error) {
                        alert(data.error);
                        return;
                    }


                    likeB.classList.toggle("liked", data.liked);

                    likeB.querySelector(".cHeart").textContent = data.liked ? "❤️" : "🤍";

                    likeB.querySelector(".cLikeCount").textContent = data.count;


                } catch (err) {

                    alert("Something went wrong. Please try again.");

                } finally {

                    likeB.disabled = false;

                }


                return;

            }


            // "Reply" → open the reply box of the TOP-LEVEL comment
            // (replies attach one level deep, like Instagram)

            const replyB = e.target.closest(".replyBtn");

            if (replyB) {


                let commentEl = replyB.closest(".comment");

                const outer = commentEl.parentElement.closest(".comment");

                if (outer) {
                    commentEl = outer;
                }


                const form = commentEl.querySelector(".reply-form");

                form.hidden = !form.hidden;

                if (!form.hidden) {
                    form.querySelector("input").focus();
                }

            }


        });


        // Reply form submits: also delegated

        post.addEventListener("submit", (e) => {


            const form = e.target.closest(".reply-form");

            if (!form) return;


            e.preventDefault();


            const input = form.querySelector("input");
            const content = input.value.trim();

            if (content === "") return;


            const commentEl = form.closest(".comment");

            submitComment(
                content,
                commentEl.dataset.commentId,
                commentEl.querySelector(".replies"),
                input
            );

            form.hidden = true;


        });



        // ---- Edit own post ----

        const editBtn = post.querySelector(".editBtn");


        if (editBtn) {


            editBtn.addEventListener("click", () => {


                // Already editing? Do nothing.

                if (post.querySelector(".post-edit")) return;


                const contentEl = post.querySelector(".post-content");


                // Build the inline editor, pre-filled with the raw content

                const editor = document.createElement("div");

                editor.className = "post-edit";

                editor.innerHTML = `
                    <textarea rows="3" maxlength="1000"></textarea>

                    <div class="post-edit-actions">
                        <button type="button" class="outlineBtn cancelEdit">Cancel</button>
                        <button type="button" class="submitBtn small saveEdit">Save</button>
                    </div>
                `;

                editor.querySelector("textarea").value = post.dataset.content;


                contentEl.hidden = true;

                contentEl.after(editor);



                // Cancel

                editor.querySelector(".cancelEdit").addEventListener("click", () => {

                    editor.remove();

                    contentEl.hidden = false;

                });



                // Save

                editor.querySelector(".saveEdit").addEventListener("click", async () => {


                    const newContent = editor.querySelector("textarea").value.trim();


                    if (newContent === "") {
                        alert("Post cannot be empty.");
                        return;
                    }


                    try {

                        const body = new FormData();
                        body.append("post_id", postId);
                        body.append("content", newContent);


                        const res = await fetch("edit_post.php", { method: "POST", body });

                        const data = await res.json();


                        if (data.error) {
                            alert(data.error);
                            return;
                        }


                        // Show the updated content (escaped + line breaks)

                        contentEl.innerHTML = escapeHtml(data.content).replace(/\n/g, "<br>");

                        post.dataset.content = data.content;


                        // Add the "edited" mark if it isn't there yet

                        const meta = post.querySelector(".post-meta span");

                        if (!meta.innerHTML.includes("edited")) {
                            meta.innerHTML += " · <em>edited</em>";
                        }


                        editor.remove();

                        contentEl.hidden = false;


                    } catch (err) {

                        alert("Something went wrong. Please try again.");

                    }


                });


            });


        }



        // ---- Delete own post ----

        const deleteBtn = post.querySelector(".deleteBtn");


        if (deleteBtn) {


            deleteBtn.addEventListener("click", async () => {


                if (!confirm("Delete this post?")) return;


                try {

                    const body = new FormData();
                    body.append("post_id", postId);


                    const res = await fetch("delete_post.php", { method: "POST", body });

                    const data = await res.json();


                    if (data.error) {
                        alert(data.error);
                        return;
                    }


                    post.remove();


                } catch (err) {

                    alert("Something went wrong. Please try again.");

                }


            });


        }


    });




    // ============================
    // Notification badge polling
    // (checks for new notifications every 30 seconds)
    // ============================

    const notifBadge = document.getElementById("notifBadge");


    if (notifBadge) {


        async function refreshNotifBadge() {

            try {

                const res = await fetch("notif_count.php");
                const data = await res.json();

                if (typeof data.count === "number") {

                    notifBadge.textContent = data.count > 9 ? "9+" : data.count;
                    notifBadge.hidden = data.count === 0;

                }


                // Messages badge too

                const msgBadge = document.getElementById("msgBadge");

                if (msgBadge && typeof data.messages === "number") {

                    msgBadge.textContent = data.messages > 9 ? "9+" : data.messages;
                    msgBadge.hidden = data.messages === 0;

                }

            } catch (err) {
                // Ignore network hiccups; we'll try again in 30s
            }

        }


        setInterval(refreshNotifBadge, 30000);


    }



    // ============================
    // Stories: the + button opens the file picker,
    // choosing a photo uploads it immediately
    // ============================

    const storyInput = document.getElementById("storyInput");


    if (storyInput) {


        document.querySelectorAll("[data-open-story-upload]").forEach((el) => {

            el.addEventListener("click", (e) => {

                e.preventDefault();

                storyInput.click();

            });

        });


        storyInput.addEventListener("change", () => {

            if (storyInput.files.length > 0) {

                document.getElementById("storyForm").submit();

            }

        });


    }



    // ============================
    // ✨ AI post generation
    // Fills the composer with generated text + photo;
    // the user reviews and clicks Post themselves.
    // ============================

    const aiBtn = document.getElementById("aiBtn");


    if (aiBtn) {


        const aiTextarea = document.getElementById("postContent");
        const aiPhotoInput = document.getElementById("photoInput");


        aiBtn.addEventListener("click", async () => {


            aiBtn.disabled = true;
            aiBtn.classList.add("loading");
            aiBtn.textContent = "✨ Generating...";


            try {

                const res = await fetch("ai_generate.php", { method: "POST" });

                // Read as TEXT first: if PHP crashed and sent HTML or a
                // blank page, we show the raw beginning of it instead of
                // a useless generic failure.

                const raw = await res.text();

                let data;

                try {

                    data = JSON.parse(raw);

                } catch (parseErr) {

                    alert(
                        "The server's answer isn't JSON — usually a PHP error. " +
                        "It starts with:\n\n" + (raw.trim().slice(0, 400) || "(completely empty response)")
                    );

                    return;

                }


                if (data.error) {
                    alert("AI error: " + data.error);
                    return;
                }


                // Non-fatal issues (e.g. photo download failed) land in
                // the console, not in your face

                if (data.warning) {
                    console.warn("AI warning:", data.warning);
                }


                // 1. Text into the composer — and fire the input event
                //    so the char counter and Post button update

                aiTextarea.value = data.content;

                aiTextarea.dispatchEvent(new Event("input"));


                // 2. The photo: turn the data URL into a real File and
                //    place it into the normal photo input. From there
                //    the existing preview + upload pipeline takes over.

                if (data.image && aiPhotoInput) {

                    const blob = await (await fetch(data.image)).blob();

                    const file = new File([blob], "ai-photo.jpg", { type: blob.type });

                    const dt = new DataTransfer();

                    dt.items.add(file);

                    aiPhotoInput.files = dt.files;

                    aiPhotoInput.dispatchEvent(new Event("change"));

                }


                aiTextarea.focus();


            } catch (err) {

                alert("Generation failed. Please try again.");

            } finally {

                aiBtn.disabled = false;
                aiBtn.classList.remove("loading");
                aiBtn.textContent = "✨ AI";

            }


        });


    }



    // ============================
    // 📸 Camera capture
    // In-app live camera (getUserMedia) with a native-camera-app
    // fallback. The shot lands in the normal photo input, so the
    // existing preview + upload pipeline takes over.
    // ============================

    const cameraBtn = document.getElementById("cameraBtn");


    if (cameraBtn) {


        const camPhotoInput = document.getElementById("photoInput");
        const nativeInput = document.getElementById("nativeCameraInput");

        let camStream = null;
        let camFacing = "environment";   // back camera first; 🔄 flips to "user"
        let camModal = null;
        let camVideo = null;


        // Put a File into the photo input and wake up the preview

        function deliverPhoto(file) {

            const dt = new DataTransfer();

            dt.items.add(file);

            camPhotoInput.files = dt.files;

            camPhotoInput.dispatchEvent(new Event("change"));

        }


        // Fallback path: the device's own camera app took the photo

        nativeInput.addEventListener("change", () => {

            if (nativeInput.files.length > 0) {

                deliverPhoto(nativeInput.files[0]);

                nativeInput.value = "";

            }

        });


        function stopStream() {

            if (camStream) {

                camStream.getTracks().forEach((t) => t.stop());

                camStream = null;

            }

        }


        function closeCamera() {

            stopStream();

            if (camModal) {

                camModal.remove();

                camModal = null;

            }

        }


        async function startStream() {

            stopStream();

            camStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: camFacing },
                audio: false
            });

            camVideo.srcObject = camStream;

            // Selfie preview is mirrored (like every camera app);
            // the SAVED photo stays unmirrored — that's the convention

            camVideo.classList.toggle("mirrored", camFacing === "user");

        }


        function openCameraModal() {


            camModal = document.createElement("div");

            camModal.className = "camera-overlay";

            camModal.innerHTML = `
                <div class="camera-panel">

                    <video id="camVideo" autoplay playsinline></video>

                    <button type="button" class="camCloseBtn" title="Close">✕</button>

                    <div class="camera-controls">

                        <span class="cam-spacer"></span>

                        <button type="button" class="shutterBtn" title="Take photo"></button>

                        <button type="button" class="camSwitchBtn" title="Switch camera">🔄</button>

                    </div>

                </div>
            `;

            document.body.appendChild(camModal);

            camVideo = camModal.querySelector("#camVideo");


            // Close: button, backdrop click, or Escape

            camModal.querySelector(".camCloseBtn").addEventListener("click", closeCamera);

            camModal.addEventListener("click", (e) => {

                if (e.target === camModal) closeCamera();

            });


            // 🔄 front/back camera

            camModal.querySelector(".camSwitchBtn").addEventListener("click", async () => {

                camFacing = camFacing === "environment" ? "user" : "environment";

                try {

                    await startStream();

                } catch (err) {

                    alert("Could not switch cameras on this device.");

                }

            });


            // The shutter: freeze the current frame onto a canvas,
            // turn it into a JPEG File

            camModal.querySelector(".shutterBtn").addEventListener("click", () => {


                if (!camVideo.videoWidth) return;   // stream not ready yet


                const canvas = document.createElement("canvas");

                canvas.width = camVideo.videoWidth;
                canvas.height = camVideo.videoHeight;

                canvas.getContext("2d").drawImage(camVideo, 0, 0);


                canvas.toBlob((blob) => {

                    if (!blob) {
                        alert("Could not capture the photo. Please try again.");
                        return;
                    }

                    deliverPhoto(new File([blob], "camera.jpg", { type: "image/jpeg" }));

                    closeCamera();

                }, "image/jpeg", 0.92);


            });

        }


        document.addEventListener("keydown", (e) => {

            if (e.key === "Escape" && camModal) closeCamera();

        });


        cameraBtn.addEventListener("click", async () => {


            // No in-app camera available (old browser, or the page is
            // not on localhost/https) → the native camera app instead

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {

                nativeInput.click();

                return;

            }


            openCameraModal();


            try {

                await startStream();

            } catch (err) {


                closeCamera();


                if (err.name === "NotAllowedError") {

                    alert("Camera access was denied. Allow it in the browser (the camera icon in the address bar) and try again.");

                }

                else if (err.name === "NotFoundError") {

                    alert("No camera was found on this device.");

                }

                else {

                    // Anything else → the native camera can still save the day

                    nativeInput.click();

                }

            }


        });


    }

});