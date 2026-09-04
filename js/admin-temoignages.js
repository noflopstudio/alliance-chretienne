document.addEventListener("DOMContentLoaded", () => {
    const supabase = window.supabaseClient;

    if (!supabase) {
        console.error("Supabase n'est pas disponible.");
        return;
    }

    const container = document.getElementById("testimonialsContainer");
    const alertContainer = document.getElementById("alertContainer");

    const totalTestimonials = document.getElementById("totalTestimonials");
    const pendingTestimonials = document.getElementById("pendingTestimonials");
    const approvedTestimonials = document.getElementById("approvedTestimonials");

    const filterButtons = document.querySelectorAll(".filter-btn");

    const viewModal = document.getElementById("viewModal");
    const viewModalBody = document.getElementById("viewModalBody");

    const rejectModal = document.getElementById("rejectModal");
    const rejectionReason = document.getElementById("rejectionReason");
    const confirmRejectButton = document.getElementById("confirmRejectButton");

    let testimonials = [];
    let currentFilter = "all";
    let testimonialToReject = null;

    async function getCurrentAdmin() {
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error || !user) {
            throw new Error("Administrateur non connecté.");
        }

        return user;
    }

    function showAlert(message, type = "success") {
        if (!alertContainer) return;

        alertContainer.innerHTML = `
            <div class="alert ${type}">
                ${message}
            </div>
        `;

        setTimeout(() => {
            alertContainer.innerHTML = "";
        }, 4000);
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(date) {
        if (!date) return "";

        return new Date(date).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function statusLabel(status) {
        if (status === "approved") {
            return `<span class="status-badge approved">🟢 Publié</span>`;
        }

        if (status === "rejected") {
            return `<span class="status-badge rejected">🔴 Refusé</span>`;
        }

        return `<span class="status-badge pending">⏳ En attente</span>`;
    }

    async function loadTestimonials() {
        if (!container) return;

        container.innerHTML = `
            <div style="text-align:center; padding:3rem;">
                ⏳ Chargement des témoignages...
            </div>
        `;

        const { data, error } = await supabase
            .from("testimonials")
            .select(`
                id,
                user_id,
                content,
                status,
                admin_note,
                created_at,
                published_at,
                profiles (
                    first_name,
                    city,
                    country,
                    photo_url
                )
            `)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Erreur chargement témoignages :", error);

            container.innerHTML = `
                <div style="text-align:center; padding:3rem;">
                    ❌ Impossible de charger les témoignages.
                </div>
            `;

            return;
        }

        testimonials = data || [];

        updateCounters();
        renderTestimonials();
    }

    function updateCounters() {
        const total = testimonials.length;
        const pending = testimonials.filter(t => t.status === "pending").length;
        const approved = testimonials.filter(t => t.status === "approved").length;

        if (totalTestimonials) {
            totalTestimonials.textContent = total;
        }

        if (pendingTestimonials) {
            pendingTestimonials.textContent = pending;
        }

        if (approvedTestimonials) {
            approvedTestimonials.textContent = approved;
        }
    }

    function renderTestimonials() {
        let filtered = testimonials;

        if (currentFilter !== "all") {
            filtered = testimonials.filter(
                testimonial => testimonial.status === currentFilter
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:3rem;">
                    <div style="font-size:2.5rem;">💬</div>
                    <p>Aucun témoignage dans cette catégorie.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(testimonial => {
            const profile = testimonial.profiles || {};

            const firstName = profile.first_name || "Membre";
            const city = profile.city || "";
            const country = profile.country || "";

            const location = [city, country]
                .filter(Boolean)
                .join(", ");

            const initial = firstName.charAt(0).toUpperCase();

            const avatar = profile.photo_url
                ? `
                    <img
                        src="${escapeHtml(profile.photo_url)}"
                        alt="${escapeHtml(firstName)}"
                        style="
                            width:48px;
                            height:48px;
                            border-radius:50%;
                            object-fit:cover;
                        "
                    >
                `
                : `
                    <div class="avatar">
                        ${escapeHtml(initial)}
                    </div>
                `;

            return `
                <div class="testimonial-card">

                    <div class="testimonial-header">

                        <div class="testimonial-user">
                            ${avatar}

                            <div>
                                <strong>${escapeHtml(firstName)}</strong>
                                <div>
                                    🌍 ${escapeHtml(
                                        location || "Localisation inconnue"
                                    )}
                                </div>
                            </div>
                        </div>

                        ${statusLabel(testimonial.status)}

                    </div>

                    <div class="testimonial-content">
                        <div class="quote">❝</div>

                        <p>
                            ${escapeHtml(testimonial.content)}
                        </p>
                    </div>

                    <div class="testimonial-date">
                        📅 Envoyé le ${formatDate(testimonial.created_at)}
                    </div>

                    <div class="testimonial-actions">

                        <button
                            type="button"
                            class="action-btn view-btn"
                            data-id="${testimonial.id}">
                            👁️ Voir
                        </button>

                        ${
                            testimonial.status === "pending"
                                ? `
                                    <button
                                        type="button"
                                        class="action-btn publish-btn"
                                        data-id="${testimonial.id}">
                                        🟢 Publier
                                    </button>

                                    <button
                                        type="button"
                                        class="action-btn reject-btn"
                                        data-id="${testimonial.id}">
                                        🔴 Refuser
                                    </button>
                                `
                                : ""
                        }

                    </div>

                </div>
            `;
        }).join("");

        attachEvents();
    }

    function attachEvents() {
        document.querySelectorAll(".view-btn").forEach(button => {
            button.addEventListener("click", () => {
                const testimonial = testimonials.find(
                    item => item.id === button.dataset.id
                );

                if (testimonial) {
                    openViewModal(testimonial);
                }
            });
        });

        document.querySelectorAll(".publish-btn").forEach(button => {
            button.addEventListener("click", () => {
                publishTestimonial(button.dataset.id);
            });
        });

        document.querySelectorAll(".reject-btn").forEach(button => {
            button.addEventListener("click", () => {
                openRejectModal(button.dataset.id);
            });
        });
    }

    function openViewModal(testimonial) {
        const profile = testimonial.profiles || {};

        const firstName = profile.first_name || "Membre";

        if (!viewModal || !viewModalBody) return;

        viewModalBody.innerHTML = `
            <div style="text-align:center;">

                <div style="font-size:3rem; margin-bottom:1rem;">
                    ❝
                </div>

                <p style="
                    font-size:1.1rem;
                    line-height:1.7;
                    margin-bottom:1.5rem;
                ">
                    « ${escapeHtml(testimonial.content)} »
                </p>

                <strong>
                    ${escapeHtml(firstName)}
                </strong>

                <div style="margin-top:.5rem;">
                    ${statusLabel(testimonial.status)}
                </div>

            </div>
        `;

        viewModal.classList.add("active");
    }

    function closeViewModal() {
        if (viewModal) {
            viewModal.classList.remove("active");
        }
    }

    function openRejectModal(id) {
        testimonialToReject = id;

        if (rejectionReason) {
            rejectionReason.value = "";
        }

        if (rejectModal) {
            rejectModal.classList.add("active");
        }
    }

    function closeRejectModal() {
        testimonialToReject = null;

        if (rejectModal) {
            rejectModal.classList.remove("active");
        }
    }

    async function createNotification(
        recipientId,
        senderId,
        type,
        content,
        testimonialId
    ) {
        const { error } = await supabase
            .from("notifications")
            .insert({
                recipient_id: recipientId,
                sender_id: senderId,
                type: type,
                content: content,
                data: {
                    testimonial_id: testimonialId
                },
                is_read: false
            });

        if (error) {
            console.error("Erreur création notification :", error);
            throw error;
        }
    }

    async function publishTestimonial(id) {
        const testimonial = testimonials.find(item => item.id === id);

        if (!testimonial) return;

        try {
            const admin = await getCurrentAdmin();

            const { error } = await supabase
                .from("testimonials")
                .update({
                    status: "approved",
                    published_at: new Date().toISOString(),
                    admin_note: null
                })
                .eq("id", id);

            if (error) {
                throw error;
            }

            await createNotification(
                testimonial.user_id,
                admin.id,
                "testimonial_approved",
                "✅ Votre témoignage a été approuvé et publié sur Alliance Chrétienne.",
                testimonial.id
            );

            showAlert(
                "✅ Le témoignage a été publié et le membre a reçu une notification."
            );

            await loadTestimonials();

        } catch (error) {
            console.error("Erreur publication :", error);

            showAlert(
                "❌ Impossible de publier le témoignage.",
                "error"
            );
        }
    }

    async function rejectTestimonial() {
        if (!testimonialToReject) return;

        const testimonial = testimonials.find(
            item => item.id === testimonialToReject
        );

        if (!testimonial) return;

        try {
            const admin = await getCurrentAdmin();

            const reason = rejectionReason
                ? rejectionReason.value.trim()
                : "";

            const { error } = await supabase
                .from("testimonials")
                .update({
                    status: "rejected",
                    admin_note: reason || null
                })
                .eq("id", testimonial.id);

            if (error) {
                throw error;
            }

            let notificationContent =
                "🔴 Votre témoignage n’a pas été retenu pour publication sur Alliance Chrétienne.";

            if (reason) {
                notificationContent += ` Motif : ${reason}`;
            }

            await createNotification(
                testimonial.user_id,
                admin.id,
                "testimonial_rejected",
                notificationContent,
                testimonial.id
            );

            closeRejectModal();

            showAlert(
                "🔴 Le témoignage a été refusé et le membre a reçu une notification."
            );

            await loadTestimonials();

        } catch (error) {
            console.error("Erreur refus :", error);

            showAlert(
                "❌ Impossible de refuser le témoignage.",
                "error"
            );
        }
    }

    filterButtons.forEach(button => {
        button.addEventListener("click", () => {
            filterButtons.forEach(btn => {
                btn.classList.remove("active");
            });

            button.classList.add("active");

            currentFilter = button.dataset.filter || "all";

            renderTestimonials();
        });
    });

    if (confirmRejectButton) {
        confirmRejectButton.addEventListener(
            "click",
            rejectTestimonial
        );
    }

    if (viewModal) {
        viewModal.addEventListener("click", event => {
            if (event.target === viewModal) {
                closeViewModal();
            }
        });
    }

    if (rejectModal) {
        rejectModal.addEventListener("click", event => {
            if (event.target === rejectModal) {
                closeRejectModal();
            }
        });
    }

    loadTestimonials();
});