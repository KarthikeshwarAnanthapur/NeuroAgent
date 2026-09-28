/* =========================
   EEG FILE UPLOAD
========================= */

const eegFile = document.getElementById("eegFile");
const fileStatus = document.getElementById("file-status");

eegFile.addEventListener("change", function () {

    if (this.files.length === 0) {
        fileStatus.textContent = "No file selected";
        return;
    }

    const file = this.files[0];

    fileStatus.textContent =
        "Selected: " + file.name;

    console.log("EEG file selected:", file);

    /*
        BACKEND CONNECTION WILL BE ADDED LATER.

        Future flow:

        EEG File
            ↓
        Backend API
            ↓
        MNE preprocessing
            ↓
        ICA
            ↓
        Agentic AI
    */
});


/* =========================
   START ANALYSIS BUTTON
========================= */

function scrollToUpload() {

    document
        .getElementById("upload")
        .scrollIntoView({
            behavior: "smooth"
        });
}


/* =========================
   VIEW PIPELINE BUTTON
========================= */

function scrollToPipeline() {

    document
        .getElementById("pipeline")
        .scrollIntoView({
            behavior: "smooth"
        });
}