// I used google for this part.
const openButton = document.getElementById("openCompose");
const modal = document.getElementById("composeModal");
const closeButton = document.getElementById("closeCompose");
const sendButton = document.getElementById("sendEmail");

openButton.addEventListener("click", function (e) {
    e.preventDefault();
    modal.classList.add("open");
});

closeButton.addEventListener("click", function (e) {
    modal.classList.remove("open");
});

window.addEventListener("click", function (e) {
    if (e.target === modal) {
        modal.classList.remove("open");
    }
});

let mailCount = 100;

sendButton.addEventListener("click", function () {
    const title = document.getElementById("emailTitle").value.trim();
    const content = document.getElementById("emailContent").value.trim();

    if (!title && !content) return;

    const mailId = "mail" + mailCount;

    const envelope = document.createElement("a");
    envelope.href = "#" + mailId;
    envelope.className = "envelope";
    const isMobile = window.innerWidth < 480;
    envelope.style.top = Math.random() * (isMobile ? 55 : 70) + "%";
    envelope.style.left = Math.random() * (isMobile ? 45 : 65) + "%";
    envelope.style.animation = "wander 20s ease-in-out infinite";

    document.querySelector(".envelopes")?.appendChild(envelope);

    const mailDiv = document.createElement("div");
    mailDiv.id = mailId;
    mailDiv.className = "mail";

    mailDiv.innerHTML = `
        <div class="mail-window">
            <a href="#" class="close">close</a>
            <h2>${title || "(no subject)"}</h2>
            <p>${content || "(no content)"}</p>
        </div>
    `;

    document.body.appendChild(mailDiv);

    document.getElementById("emailTitle").value = "";
    document.getElementById("emailContent").value = "";
    modal.classList.remove("open");
    mailCount++;
});