// ============================================================
// CROP CARE AI - COMPLETE SCRIPT.JS
// ============================================================

let selectedLanguage = "te-IN";

// ============================================================
// 1. DEFAULT CROP + DISEASE COLLECTION
// ============================================================

const cropDiseases = {

    Tomato: [
        "Healthy",
        "Early Blight",
        "Late Blight"
    ],

    Potato: [
        "Healthy",
        "Early Blight",
        "Late Blight"
    ]

    // Future lo easy ga add cheyyachu:
    // Rice: ["Healthy", "Brown Spot", "Blast"],
    // Chilli: ["Healthy", "Leaf Curl", "Anthracnose"]
};


// ============================================================
// 2. TRANSLATIONS
// ============================================================

const translations = {

    "te-IN": {

        appName: "క్రాప్ కేర్ AI",
        farmerFirst: "రైతు ముందుగా • AI ఆధారితం",

        home: "హోమ్",
        scan: "స్కాన్",
        treatment: "చికిత్స",
        daily: "రోజువారీ సంరక్షణ",
        alerts: "అలర్ట్స్",

        greeting: "స్మార్ట్ గైడెన్స్‌తో మీ పంటను రక్షించండి",

        homeDescription:
            "పంట ఫోటోను అప్లోడ్ చేసి వ్యాధి ప్రమాదాన్ని తెలుసుకోండి మరియు రైతులకు సులభమైన సూచనలు పొందండి.",

        takePhoto: "📷 పంటను చెక్ చేయండి",
        listen: "🔊 వినండి",

        temperature: "ఉష్ణోగ్రత",
        humidity: "తేమ",
        risk: "వ్యాధి ప్రమాదం",
        riskLevel: "మధ్యస్థం",

        scanTitle: "పంట వ్యాధి స్కాన్",
        scanDescription: "స్పష్టమైన ఆకులు/పంట ఫోటోను ఎంచుకోండి.",

        detectDisease: "🔍 వ్యాధిని గుర్తించండి",

        aiResult: "AI ఫలితం",

        crop: "పంట",
        earlyBlight: "టమాటో ఎర్లీ బ్లైట్",

        confidence: "నమ్మకం",
        severity: "తీవ్రత",
        moderate: "మధ్యస్థం",

        treatmentInfo: "చికిత్స సూచనలు",

        treatmentAssist:
            "గుర్తించిన వ్యాధి ఆధారంగా రైతులకు సులభమైన చర్యలు.",

        firstSteps: "మొదటి చర్యలు",

        step1:
            "ఎక్కువగా సోకిన ఆకులను తొలగించండి.",

        step2:
            "పై నుంచి నీరు పోయకుండా ఆకులను పొడిగా ఉంచండి.",

        step3:
            "స్థానికంగా ఆమోదించబడిన ఉత్పత్తిని లేబుల్ ప్రకారం మాత్రమే ఉపయోగించండి.",

        importantNote: "ముఖ్య గమనిక",

        pesticideWarning:
            "మందులు వాడే ముందు స్థానిక వ్యవసాయ అధికారుల సూచనలు మరియు ఉత్పత్తి లేబుల్‌ను ధృవీకరించండి.",

        cropProtection: "పంట రక్షణ",

        optionA: "ఎంపిక A:",

        activeIngredient:
            "అవసరమైనప్పుడు నమోదైన ఫంగిసైడ్‌ను మాత్రమే ఉపయోగించండి.",

        verifiedRequired:
            "ధృవీకరణ అవసరం:",

        labelVerification:
            "పంట, వ్యాధి, మోతాదు మరియు వేచి ఉండే కాలాన్ని లేబుల్‌లో చెక్ చేయండి.",

        safety: "భద్రత:",

        safetyText:
            "సూచించిన రక్షణ పరికరాలను ధరించి లేబుల్ సూచనలను పాటించండి.",

        apolloTitle:
            "Apollo / నిపుణుల సహకారం",

        apolloDescription:
            "నిపుణుల సమీక్షను వెరిఫైడ్ డేటా మరియు సలహా లేయర్‌గా జోడించవచ్చు.",

        partnerVerified:
            "ధృవీకరణ లేయర్",

        requestReview:
            "నిపుణుల సమీక్ష కోరండి",

        dailyTitle:
            "రోజువారీ పంట సంరక్షణ",

        dailyDescription:
            "ప్రతి రోజు పంటను రక్షించడానికి సులభమైన చర్యలు.",

        weather: "వాతావరణం",

        diseaseRisk:
            "వ్యాధి ప్రమాదం",

        medium: "మధ్యస్థం",

        todaysAction:
            "ఈరోజు చర్య",

        todayActionText:
            "కింది ఆకులను పరిశీలించి సోకిన భాగాలను తొలగించండి.",

        dailyUpdate:
            "🔊 రోజువారీ అప్‌డేట్ వినండి",

        farmerAlerts:
            "రైతు అలర్ట్స్",

        riskAlert:
            "వ్యాధి ప్రమాద అలర్ట్",

        riskAlertText:
            "ప్రస్తుత పరిస్థితుల్లో వ్యాధి ప్రమాదం మధ్యస్థంగా ఉంది.",

        nearbyAlert:
            "సమీప వ్యాధి వ్యాప్తి",

        nearbyAlertText:
            "మీ ప్రాంతానికి సమీపంలో వ్యాధి గుర్తించినప్పుడు రైతులకు అలర్ట్ పంపవచ్చు.",

        voiceAlert:
            "🔊 అలర్ట్ వినండి",

        language:
            "భాష"
    },


    // ========================================================
    // HINDI
    // ========================================================

    "hi-IN": {

        appName: "क्रॉप केयर AI",
        farmerFirst: "किसान पहले • AI आधारित",

        home: "होम",
        scan: "स्कैन",
        treatment: "उपचार",
        daily: "दैनिक देखभाल",
        alerts: "अलर्ट",

        greeting:
            "स्मार्ट मार्गदर्शन से अपनी फसल बचाएं",

        homeDescription:
            "फसल की फोटो अपलोड करके बीमारी का जोखिम जानें और आसान सलाह पाएं।",

        takePhoto: "📷 फसल जांचें",
        listen: "🔊 सुनें",

        temperature: "तापमान",
        humidity: "नमी",
        risk: "बीमारी का जोखिम",
        riskLevel: "मध्यम",

        scanTitle:
            "फसल बीमारी स्कैन",

        scanDescription:
            "पत्ते/फसल की साफ फोटो चुनें।",

        detectDisease:
            "🔍 बीमारी पहचानें",

        aiResult:
            "AI परिणाम",

        crop:
            "फसल",

        earlyBlight:
            "टमाटर अर्ली ब्लाइट",

        confidence:
            "विश्वास",

        severity:
            "गंभीरता",

        moderate:
            "मध्यम",

        treatmentInfo:
            "उपचार मार्गदर्शन",

        treatmentAssist:
            "पहचानी गई बीमारी के आधार पर किसान के लिए आसान कदम।",

        firstSteps:
            "पहले कदम",

        step1:
            "बहुत संक्रमित पत्तियों को हटाएं।",

        step2:
            "ऊपर से पानी देने से बचें और पत्तियों को सूखा रखें।",

        step3:
            "केवल स्थानीय रूप से स्वीकृत उत्पाद को लेबल के अनुसार उपयोग करें।",

        importantNote:
            "महत्वपूर्ण",

        pesticideWarning:
            "किसी भी दवा से पहले स्थानीय कृषि सलाह और उत्पाद लेबल की पुष्टि करें।",

        cropProtection:
            "फसल सुरक्षा",

        optionA:
            "विकल्प A:",

        activeIngredient:
            "जरूरत होने पर केवल पंजीकृत फंगीसाइड का उपयोग करें।",

        verifiedRequired:
            "सत्यापन जरूरी:",

        labelVerification:
            "लेबल पर फसल, बीमारी, मात्रा और प्रतीक्षा अवधि जांचें।",

        safety:
            "सुरक्षा:",

        safetyText:
            "सुरक्षा उपकरण पहनें और लेबल के निर्देशों का पालन करें।",

        apolloTitle:
            "Apollo / विशेषज्ञ सहयोग",

        apolloDescription:
            "विशेषज्ञ समीक्षा को सत्यापित डेटा और सलाह की परत के रूप में जोड़ा जा सकता है।",

        partnerVerified:
            "सत्यापन परत",

        requestReview:
            "विशेषज्ञ समीक्षा मांगें",

        dailyTitle:
            "दैनिक फसल देखभाल",

        dailyDescription:
            "हर दिन फसल की सुरक्षा के लिए आसान कदम।",

        weather:
            "मौसम",

        diseaseRisk:
            "बीमारी का जोखिम",

        medium:
            "मध्यम",

        todaysAction:
            "आज का काम",

        todayActionText:
            "निचली पत्तियों की जांच करें और संक्रमित हिस्से हटाएं।",

        dailyUpdate:
            "🔊 दैनिक अपडेट सुनें",

        farmerAlerts:
            "किसान अलर्ट",

        riskAlert:
            "बीमारी जोखिम अलर्ट",

        riskAlertText:
            "वर्तमान परिस्थितियों में बीमारी का जोखिम मध्यम है।",

        nearbyAlert:
            "पास में बीमारी का प्रकोप",

        nearbyAlertText:
            "आपके क्षेत्र के पास बीमारी पाए जाने पर किसानों को अलर्ट भेजा जा सकता है।",

        voiceAlert:
            "🔊 अलर्ट सुनें",

        language:
            "भाषा"
    },


    // ========================================================
    // ENGLISH
    // ========================================================

    "en-IN": {

        appName:
            "Crop Care AI",

        farmerFirst:
            "Farmer First • AI Powered",

        home:
            "Home",

        scan:
            "Scan",

        treatment:
            "Treatment",

        daily:
            "Daily Care",

        alerts:
            "Alerts",

        greeting:
            "Protect your crop with smart guidance",

        homeDescription:
            "Upload a crop image to check disease risk and get farmer-friendly guidance.",

        takePhoto:
            "📷 Check Crop",

        listen:
            "🔊 Listen",

        temperature:
            "Temperature",

        humidity:
            "Humidity",

        risk:
            "Disease Risk",

        riskLevel:
            "Medium",

        scanTitle:
            "Crop Disease Scan",

        scanDescription:
            "Select a clear leaf/crop photo.",

        detectDisease:
            "🔍 Detect Disease",

        aiResult:
            "AI Result",

        crop:
            "Crop",

        earlyBlight:
            "Tomato Early Blight",

        confidence:
            "Confidence",

        severity:
            "Severity",

        moderate:
            "Moderate",

        treatmentInfo:
            "Treatment Guidance",

        treatmentAssist:
            "Farmer-friendly steps based on the detected disease.",

        firstSteps:
            "First steps",

        step1:
            "Remove heavily infected leaves.",

        step2:
            "Avoid overhead watering and keep leaves dry.",

        step3:
            "Use only a locally approved product according to its label.",

        importantNote:
            "Important",

        pesticideWarning:
            "Pesticide recommendations must be verified with local agricultural guidance and the product label before use.",

        cropProtection:
            "Crop Protection",

        optionA:
            "Option A:",

        activeIngredient:
            "Use a registered fungicide only when appropriate.",

        verifiedRequired:
            "Verified Required:",

        labelVerification:
            "Check crop, disease, dosage and waiting period on the label.",

        safety:
            "Safety:",

        safetyText:
            "Wear recommended protective equipment and follow label instructions.",

        apolloTitle:
            "Apollo / Expert Collaboration",

        apolloDescription:
            "Expert review can be added as a verified-data and advisory layer.",

        partnerVerified:
            "Verification layer",

        requestReview:
            "Request Expert Review",

        dailyTitle:
            "Daily Crop Care",

        dailyDescription:
            "Simple actions to protect your crop every day.",

        weather:
            "Weather",

        diseaseRisk:
            "Disease Risk",

        medium:
            "Medium",

        todaysAction:
            "Today's Action",

        todayActionText:
            "Inspect lower leaves and remove clearly infected plant material.",

        dailyUpdate:
            "🔊 Hear Daily Update",

        farmerAlerts:
            "Farmer Alerts",

        riskAlert:
            "Disease Risk Alert",

        riskAlertText:
            "Moderate disease risk detected in the current conditions.",

        nearbyAlert:
            "Nearby Outbreak",

        nearbyAlertText:
            "Farmers can be alerted when a disease is detected near their area.",

        voiceAlert:
            "🔊 Hear Alert",

        language:
            "Language"
    }
};


// ============================================================
// 3. VOICE TEXT
// ============================================================

const voiceText = {

    "te-IN": {

        voiceIntro:
            "నమస్కారం రైతు గారు. క్రాప్ కేర్ AI కి స్వాగతం. మీ పంట ఫోటోను స్కాన్ చేసి వ్యాధి ప్రమాదాన్ని తెలుసుకోండి.",

        treatmentIntro:
            "వ్యాధి గుర్తించిన తర్వాత సోకిన ఆకులను తొలగించండి. ఏ మందు వాడే ముందు స్థానిక వ్యవసాయ సలహా మరియు ఉత్పత్తి లేబుల్‌ను ధృవీకరించండి.",

        dailyVoice:
            "ఈరోజు పంట సంరక్షణ: కింది ఆకులను పరిశీలించి సోకిన భాగాలను తొలగించండి.",

        nearbyVoice:
            "రైతు అలర్ట్. మీ ప్రాంతానికి సమీపంలో వ్యాధి గుర్తించబడింది. మీ పంటను పరిశీలించండి."
    },


    "hi-IN": {

        voiceIntro:
            "नमस्ते किसान जी। क्रॉप केयर AI में आपका स्वागत है। फसल की फोटो स्कैन करके बीमारी का जोखिम जानें।",

        treatmentIntro:
            "बीमारी की पहचान होने के बाद संक्रमित पत्तियां हटाएं। किसी भी दवा से पहले स्थानीय कृषि सलाह और उत्पाद लेबल की पुष्टि करें।",

        dailyVoice:
            "आज की फसल देखभाल: निचली पत्तियों की जांच करें और संक्रमित हिस्से हटाएं।",

        nearbyVoice:
            "किसान अलर्ट। आपके क्षेत्र के पास बीमारी का पता चला है। अपनी फसल की जांच करें।"
    },


    "en-IN": {

        voiceIntro:
            "Hello farmer. Welcome to Crop Care AI. Scan your crop photo to check disease risk.",

        treatmentIntro:
            "After disease detection, remove infected leaves. Before using any pesticide or fungicide, verify local agricultural advice and the product label.",

        dailyVoice:
            "Today's crop care: inspect lower leaves and remove infected plant material.",

        nearbyVoice:
            "Farmer alert. A disease was detected near your area. Please inspect your crop."
    }
};


// ============================================================
// 4. VOICE SYSTEM
// ============================================================

function getBestVoice(language) {

    if (!("speechSynthesis" in window)) {
        return null;
    }

    const voices = speechSynthesis.getVoices();

    if (!voices.length) {
        return null;
    }

    const exact = voices.find(
        voice =>
            voice.lang &&
            voice.lang.toLowerCase() ===
            language.toLowerCase()
    );

    if (exact) {
        return exact;
    }

    const prefix =
        language
            .split("-")[0]
            .toLowerCase();

    return voices.find(
        voice =>
            voice.lang &&
            voice.lang
                .toLowerCase()
                .startsWith(prefix)
    );
}


function speak(text) {

    if (!("speechSynthesis" in window)) {

        alert(
            "Speech is not supported in this browser."
        );

        return;
    }

    speechSynthesis.cancel();

    const utterance =
        new SpeechSynthesisUtterance(text);

    utterance.lang =
        selectedLanguage;

    utterance.rate = 0.9;

    utterance.pitch = 1;

    const voice =
        getBestVoice(selectedLanguage);

    if (voice) {
        utterance.voice = voice;
    }

    speechSynthesis.speak(utterance);
}


function speakKey(key) {

    const text =
        voiceText[selectedLanguage]?.[key] ||
        voiceText["en-IN"]?.[key];

    if (text) {
        speak(text);
    }
}


// ============================================================
// 5. LANGUAGE CHANGE
// ============================================================

function setLanguage(language) {

    selectedLanguage = language;

    const languageData =
        translations[language] ||
        translations["en-IN"];

    document
        .querySelectorAll("[data-i18n]")
        .forEach(element => {

            const key =
                element.getAttribute("data-i18n");

            if (
                languageData[key] !== undefined
            ) {

                element.textContent =
                    languageData[key];
            }
        });


    document.documentElement.lang =
        language;


    const confirmation = {

        "te-IN":
            "తెలుగు భాష ఎంపిక చేయబడింది.",

        "hi-IN":
            "हिंदी भाषा चुनी गई है।",

        "en-IN":
            "English language selected."
    };


    setTimeout(() => {

        speak(
            confirmation[language] ||
            confirmation["en-IN"]
        );

    }, 100);
}


// ============================================================
// 6. TAB SYSTEM
// ============================================================

function openTab(
    screenId,
    button = null
) {

    const target =
        document.getElementById(screenId);

    if (!target) {
        return;
    }


    document
        .querySelectorAll(".screen")
        .forEach(screen => {

            screen.classList.remove(
                "active"
            );

        });


    target.classList.add("active");


    document
        .querySelectorAll(".tabs button")
        .forEach(btn => {

            btn.classList.remove(
                "active"
            );

        });


    if (button) {
        button.classList.add("active");
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ============================================================
// 7. IMAGE PREVIEW
// ============================================================

function previewImage(event) {

    const file =
        event.target.files &&
        event.target.files[0];

    const preview =
        document.getElementById("preview");


    if (!file || !preview) {
        return;
    }


    preview.src =
        URL.createObjectURL(file);

    preview.style.display =
        "block";


    const result =
        document.getElementById(
            "diagnosisResult"
        );

    if (result) {
        result.classList.add(
            "hidden"
        );
    }
}


// ============================================================
// 8. NEARBY ALERT SYSTEM
// ============================================================

let nearbyAlerts = [];


function addNearbyAlert(message) {

    nearbyAlerts.push({

        message: message,

        time:
            new Date()
                .toLocaleTimeString()

    });


    updateAlertCount();

    playBuzzer();


    if (
        "Notification" in window &&
        Notification.permission ===
            "granted"
    ) {

        new Notification(
            "🌱 Crop Care AI",
            {
                body: message
            }
        );
    }
}


function updateAlertCount() {

    const count =
        document.getElementById(
            "alertCount"
        );

    if (count) {

        count.textContent =
            nearbyAlerts.length;
    }
}


function playBuzzer() {

    /*
       Browser audio may require
       previous user interaction.
    */

    const audio =
        new Audio(
            "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
        );


    audio.play().catch(() => {

        console.log(
            "Buzzer needs user interaction."
        );

    });
}


function showAlerts() {

    if (
        nearbyAlerts.length === 0
    ) {

        alert(
            selectedLanguage ===
                "te-IN"

                ? "🔔 కొత్త అలర్ట్స్ లేవు."

                : selectedLanguage ===
                  "hi-IN"

                ? "🔔 कोई नया अलर्ट नहीं है।"

                : "🔔 No new alerts."
        );

        return;
    }


    const message =
        nearbyAlerts
            .map(
                alertItem =>
                    "🔔 " +
                    alertItem.message +
                    "\n" +
                    alertItem.time
            )
            .join("\n\n");


    alert(message);
}


// ============================================================
// 9. BROWSER NOTIFICATION PERMISSION
// ============================================================

async function enableNotifications() {

    if (
        "Notification" in window
    ) {

        try {

            const permission =
                await Notification
                    .requestPermission();

            if (
                permission ===
                "granted"
            ) {

                console.log(
                    "Notifications enabled"
                );

            }

        } catch (error) {

            console.log(
                "Notification permission error:",
                error
            );

        }
    }
}


// ============================================================
// 10. DISEASE DETECTION
// ============================================================

async function detectDisease() {

    console.log(
        "detectDisease() started"
    );


    const input =
        document.getElementById(
            "cropImage"
        );


    if (!input) {

        alert(
            "cropImage element not found!"
        );

        return;
    }


    if (
        !input.files ||
        input.files.length === 0
    ) {

        const message = {

            "te-IN":
                "ముందుగా పంట ఫోటోను ఎంచుకోండి.",

            "hi-IN":
                "पहले फसल की फोटो चुनें।",

            "en-IN":
                "Please select a crop photo first."
        };


        alert(
            message[selectedLanguage]
        );

        return;
    }


    const file =
        input.files[0];


    console.log(
        "Selected image:",
        file.name
    );


    const formData =
        new FormData();


    formData.append(
        "file",
        file
    );


    // ========================================================
    // BACKEND AI CONNECTION
    // ========================================================

    try {

        console.log(
            "Sending image to AI backend..."
        );


        const response =
            await fetch(
                "http://127.0.0.1:8000/predict",
                {
                    method: "POST",
                    body: formData
                }
            );


        console.log(
            "Backend response:",
            response
        );


        if (!response.ok) {

            throw new Error(
                "Backend returned " +
                response.status
            );

        }


        const data =
            await response.json();


        console.log(
            "AI RESULT:",
            data
        );


        // ====================================================
        // SHOW AI RESULT
        // ====================================================

        const resultBox =
            document.getElementById(
                "diagnosisResult"
            );


        if (resultBox) {

            resultBox.classList.remove(
                "hidden"
            );
        }


        /*
           Supports different backend
           response names.
        */

        const disease =
            data.disease ||
            data.prediction ||
            "Unknown";


        const confidence =
            data.confidence !== undefined
                ? data.confidence
                : "--";


        const crop =
            data.crop ||
            getCropFromDisease(
                disease
            );


        const severity =
            data.severity ||
            getSeverity(
                confidence
            );


        // ====================================================
        // UPDATE RESULT ELEMENTS
        // ====================================================

        const cropElement =
            document.getElementById(
                "resultCrop"
            );


        const diseaseElement =
            document.getElementById(
                "resultDisease"
            );


        const confidenceElement =
            document.getElementById(
                "resultConfidence"
            );


        const severityElement =
            document.getElementById(
                "resultSeverity"
            );


        if (cropElement) {

            cropElement.textContent =
                crop;

        }


        if (diseaseElement) {

            diseaseElement.textContent =
                disease;

        }


        if (confidenceElement) {

            confidenceElement.textContent =
                confidence + "%";

        }


        if (severityElement) {

            severityElement.textContent =
                severity;

        }


        // ====================================================
        // VOICE RESULT
        // ====================================================

        const voiceMessage = {

            "te-IN":
                `మీ పంటలో ${disease} గుర్తించబడింది. నమ్మకం ${confidence} శాతం.`,

            "hi-IN":
                `आपकी फसल में ${disease} पाया गया है। विश्वास ${confidence} प्रतिशत है।`,

            "en-IN":
                `Your crop has been identified as ${disease}. Confidence is ${confidence} percent.`
        };


        speak(
            voiceMessage[
                selectedLanguage
            ]
        );


        // ====================================================
        // NEARBY ALERT
        // ====================================================

        /*
           Demo/prototype alert.

           Real nearby farmer filtering
           must happen in backend.
        */

        if (
            disease &&
            disease.toLowerCase()
                !== "healthy"
        ) {

            const alertMessage = {

                "te-IN":
                    `${disease} గుర్తించబడింది. మీ ప్రాంతంలోని రైతులు పంటను పరిశీలించండి.`,

                "hi-IN":
                    `${disease} पाया गया है। आपके क्षेत्र के किसान अपनी फसल की जांच करें।`,

                "en-IN":
                    `${disease} detected. Farmers in the area should inspect their crops.`
            };


            addNearbyAlert(
                alertMessage[
                    selectedLanguage
                ]
            );
        }


    } catch (error) {

        console.error(
            "AI BACKEND ERROR:",
            error
        );


        const message = {

            "te-IN":
                "AI Backend connect అవ్వలేదు. Backend server running లో ఉందో check చేయండి.",

            "hi-IN":
                "AI Backend connect नहीं हुआ। Backend server चल रहा है या नहीं जांचें।",

            "en-IN":
                "AI Backend could not be connected. Please check that the backend server is running."
        };


        alert(
            message[selectedLanguage]
        );
    }
}


// ============================================================
// 11. GET CROP FROM DISEASE NAME
// ============================================================

function getCropFromDisease(
    disease
) {

    const text =
        disease.toLowerCase();


    if (
        text.includes("tomato")
    ) {

        return "Tomato";
    }


    if (
        text.includes("potato")
    ) {

        return "Potato";
    }


    return "Unknown";
}


// ============================================================
// 12. SEVERITY
// ============================================================

function getSeverity(
    confidence
) {

    const value =
        parseFloat(
            confidence
        );


    if (
        isNaN(value)
    ) {

        return "Unknown";
    }


    if (
        value >= 90
    ) {

        return "High";
    }


    if (
        value >= 70
    ) {

        return "Moderate";
    }


    return "Low";
}


// ============================================================
// 13. EXPERT REVIEW
// ============================================================

function requestExpert() {

    const message = {

        "te-IN":
            "నిపుణుల సమీక్ష కోసం మీ అభ్యర్థన డెమోలో నమోదు చేయబడింది.",

        "hi-IN":
            "विशेषज्ञ समीक्षा के लिए आपका अनुरोध दर्ज किया गया है।",

        "en-IN":
            "Your expert review request has been recorded in the demo."
    };


    alert(
        message[selectedLanguage]
    );
}


// ============================================================
// 14. DAILY VOICE
// ============================================================

function playDailyUpdate() {

    speakKey(
        "dailyVoice"
    );
}


// ============================================================
// 15. ALERT VOICE
// ============================================================

function playAlertVoice() {

    speakKey(
        "nearbyVoice"
    );
}


// ============================================================
// 16. BUTTON EVENT SETUP
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "Crop Care AI JS Loaded Successfully"
        );


        // -----------------------------------------------
        // Default language
        // -----------------------------------------------

        setLanguage(
            "te-IN"
        );


        // -----------------------------------------------
        // Notification permission
        // -----------------------------------------------

        enableNotifications();


        // -----------------------------------------------
        // Detect button
        // -----------------------------------------------

        const detectButton =
            document.getElementById(
                "detectBtn"
            );


        if (detectButton) {

            detectButton.addEventListener(
                "click",
                detectDisease
            );

        }


        // -----------------------------------------------
        // Alert bell
        // -----------------------------------------------

        const alertBell =
            document.getElementById(
                "alertBell"
            );


        if (alertBell) {

            alertBell.addEventListener(
                "click",
                showAlerts
            );

        }


        // -----------------------------------------------
        // Load browser voices
        // -----------------------------------------------

        if (
            "speechSynthesis" in window
        ) {

            speechSynthesis.getVoices();

        }

    }
);