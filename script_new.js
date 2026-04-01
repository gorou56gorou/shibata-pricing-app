const BASE_RATES = {
    "集会室１": { "morning": 760, "afternoon": 880, "night": 1010, "full": 2140 },
    "体験学習室": { "morning": 760, "afternoon": 880, "night": 1010, "full": 2140 },
    "和室": { "morning": 880, "afternoon": 1130, "night": 1260, "full": 2520 },
    "多目的ホール": { "morning": 1640, "afternoon": 1770, "night": 2020, "full": 4290 },
    "研修室": { "morning": 760, "afternoon": 880, "night": 1010, "full": 2140 },
    "如心庵": { "flat": 3780 },
};

const GLOBAL_HEATERS = [
    { "label": "ブルーヒーター(大)", "price": 160 },
    { "label": "ブルーヒーター(中)", "price": 100 },
];

const AC_RATES_PER_HOUR = {
    "集会室１": [
        { "label": "エアコン", "price": 100 },
        { "label": "ファンヒーター", "price": 110 },
    ],
    "体験学習室": [{ "label": "エアコン", "price": 260 }],
    "和室": [
        { "label": "エアコン(1台)", "price": 100 },
        { "label": "エアコン(2台)", "price": 150 },
        { "label": "ファンヒーター", "price": 150 },
    ],
    "多目的ホール": [
        { "label": "窓際ファンのみ", "price": 90 },
        { "label": "本体＋窓際ファン", "price": 280 }
    ],
    "研修室": [
        { "label": "エアコン", "price": 190 },
        { "label": "ファンヒーター(1台)", "price": 100 },
        { "label": "ファンヒーター(2台)", "price": 170 }
    ],
    "如心庵": []
};

// 全部屋にグローバルヒーターを追加
for (let fac in AC_RATES_PER_HOUR) {
    AC_RATES_PER_HOUR[fac] = [...AC_RATES_PER_HOUR[fac], ...GLOBAL_HEATERS];
}

const REDUCTION_RATES = {
    "なし": 1.0,
    "25%減免 (町外の学校・社会教育関係団体等)": 0.75,
    "50%減免 (町内高校大学・公益法人等)": 0.50,
    "100%減免 (町・町内小中学校・町関連団体等)": 0.0
};

const metadata = {
    facilities: Object.keys(BASE_RATES),
    ac_rates: AC_RATES_PER_HOUR,
    reductions: Object.keys(REDUCTION_RATES)
};

// --- 計算ロジック ---
function calculateBasePrice(facility, slotFlags, outOfTown, forProfit) {
    let basePrice = 0;
    if (!BASE_RATES[facility]) return 0;

    const rateInfo = BASE_RATES[facility];

    if (rateInfo.flat) {
        basePrice = rateInfo.flat;
    } else {
        const isFull = slotFlags.full || (slotFlags.morning && slotFlags.afternoon && slotFlags.night);

        if (isFull) {
            basePrice += rateInfo.full || 0;
        } else {
            if (slotFlags.morning) basePrice += rateInfo.morning || 0;
            if (slotFlags.afternoon) basePrice += rateInfo.afternoon || 0;
            if (slotFlags.night) basePrice += rateInfo.night || 0;
        }
    }

    if (forProfit) {
        basePrice = basePrice * 3;
    }
    if (outOfTown) {
        basePrice = Math.floor(basePrice * 1.5);
    }

    return basePrice;
}

function calculateAcPrice(facility, acOptionsObj) {
    if (!AC_RATES_PER_HOUR[facility]) return 0;

    let totalAc = 0;
    AC_RATES_PER_HOUR[facility].forEach(option => {
        const hours = acOptionsObj[option.label] || 0;
        if (hours > 0) {
            totalAc += option.price * hours;
        }
    });
    return totalAc;
}

// --- フロントエンド連携ロジック ---
document.addEventListener('DOMContentLoaded', () => {
    let roomCount = 0;

    const roomsContainer = document.getElementById('rooms-container');
    const roomTemplate = document.getElementById('room-template');
    const addRoomBtn = document.getElementById('add-room-btn');
    const form = document.getElementById('calculator-form');

    const reductionSelect = document.getElementById('reduction');
    const outOfTownCb = document.getElementById('out_of_town');
    const forProfitCb = document.getElementById('for_profit');

    // Populate Reductions
    metadata.reductions.forEach(red => {
        const opt = document.createElement('option');
        opt.value = red;
        opt.textContent = red;
        reductionSelect.appendChild(opt);
    });

    // Add first room
    addRoom();

    function addRoom() {
        roomCount++;
        const clone = roomTemplate.content.cloneNode(true);
        const roomSection = clone.querySelector('.room-section');

        // Setup room header
        roomSection.querySelector('.room-num').textContent = roomCount;
        const removeBtn = roomSection.querySelector('.remove-room-btn');
        if (roomCount > 1) {
            removeBtn.style.display = 'inline-block';
            removeBtn.addEventListener('click', () => {
                roomSection.remove();
                updateRoomNumbers();
                calculatePrice();
            });
        }

        // Setup facility select
        const facilitySelect = roomSection.querySelector('.facility-select');
        metadata.facilities.forEach(fac => {
            const opt = document.createElement('option');
            opt.value = fac;
            opt.textContent = fac;
            facilitySelect.appendChild(opt);
        });

        // Setup AC logic
        const acListContainer = roomSection.querySelector('.ac-list-container');

        facilitySelect.addEventListener('change', (e) => {
            const fac = e.target.value;
            const acOptionsArray = metadata.ac_rates[fac] || [];

            acListContainer.innerHTML = '';

            if (acOptionsArray.length === 0) {
                acListContainer.innerHTML = '<p class="text-sm text-gray-500">利用できる冷暖房設備がありません</p>';
            } else {
                acOptionsArray.forEach((opt, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'ac-item flex align-center mb-2';
                    itemDiv.style.display = 'flex';
                    itemDiv.style.alignItems = 'center';
                    itemDiv.style.marginBottom = '8px';

                    itemDiv.innerHTML = `
                        <label class="custom-checkbox m-0" style="flex: 1; padding: 8px;">
                            <input type="checkbox" class="ac-cb" value="${opt.label}">
                            <span class="checkmark"></span>
                            <span class="label-text">${opt.label} <small>(+${opt.price}円/時)</small></span>
                        </label>
                        <div class="ac-hrs-wrap ml-2" style="display:none; align-items:center;">
                            <input type="number" class="ac-hrs" min="1" max="15" value="1" style="width: 60px; padding: 4px 8px;">
                            <span style="font-size:0.9rem; margin-left:4px;">時間</span>
                        </div>
                    `;

                    const cb = itemDiv.querySelector('.ac-cb');
                    const hrsWrap = itemDiv.querySelector('.ac-hrs-wrap');
                    const hrsInput = itemDiv.querySelector('.ac-hrs');

                    cb.addEventListener('change', () => {
                        // Mutually Exclusive Logic
                        if (cb.checked) {
                            const val = cb.value;
                            const exclusions = {
                                "本体＋窓際ファン": ["窓際ファンのみ"],
                                "窓際ファンのみ": ["本体＋窓際ファン"],
                                "エアコン(2台)": ["エアコン(1台)"],
                                "エアコン(1台)": ["エアコン(2台)"],
                                "ファンヒーター(2台)": ["ファンヒーター(1台)"],
                                "ファンヒーター(1台)": ["ファンヒーター(2台)"]
                            };
                            if (exclusions[val]) {
                                const allCbs = acListContainer.querySelectorAll('.ac-cb');
                                allCbs.forEach(otherCb => {
                                    if (exclusions[val].includes(otherCb.value) && otherCb.checked) {
                                        otherCb.checked = false;
                                        otherCb.closest('.ac-item').querySelector('.ac-hrs-wrap').style.display = 'none';
                                    }
                                });
                            }
                        }

                        hrsWrap.style.display = cb.checked ? 'flex' : 'none';
                        calculatePrice();
                    });

                    hrsInput.addEventListener('change', (e) => {
                        // Enforce max
                        const max = parseInt(e.target.max) || 15;
                        if (parseInt(e.target.value) > max) {
                            e.target.value = max;
                        }
                        calculatePrice();
                    });

                    acListContainer.appendChild(itemDiv);
                });
            }

            // Auto Update Title
            roomSection.querySelector('.room-title-text').textContent = `(${fac})`;
            calculatePrice();
        });

        // Slot exclusivity and Max AC hours logic
        const slotCbs = Array.from(roomSection.querySelectorAll('.slot-cb'));
        const fullCb = slotCbs.find(cb => cb.value === 'full');
        const otherCbs = slotCbs.filter(cb => cb.value !== 'full');

        slotCbs.forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.value === 'full') {
                    if (e.target.checked) {
                        otherCbs.forEach(c => c.checked = false);
                    }
                } else {
                    if (e.target.checked) {
                        fullCb.checked = false;
                    }
                }

                // Calculate max AC hours based on slots
                let maxHrs = 15;
                if (fullCb.checked) {
                    maxHrs = 12; // 9:00 - 21:00
                } else {
                    let total = 0;
                    if (slotCbs.find(c => c.value === 'morning').checked) total += 3;
                    if (slotCbs.find(c => c.value === 'afternoon').checked) total += 4;
                    if (slotCbs.find(c => c.value === 'night').checked) total += 4;
                    if (total > 0) maxHrs = total;
                }

                // Apply maxHrs to all AC hour inputs in this room
                const acHrsInputs = roomSection.querySelectorAll('.ac-hrs');
                acHrsInputs.forEach(input => {
                    input.max = maxHrs;
                    if (parseInt(input.value) > maxHrs) {
                        input.value = maxHrs;
                    }
                });

                calculatePrice();
            });
        });

        // Auto trigger events for DOM interaction
        const inputs = roomSection.querySelectorAll('input:not(.ac-cb):not(.ac-hrs):not(.slot-cb), select');
        inputs.forEach(input => {
            input.addEventListener('change', calculatePrice);
        });

        roomsContainer.appendChild(roomSection);

        // trigger init
        facilitySelect.dispatchEvent(new Event('change'));
    }

    function updateRoomNumbers() {
        const sections = roomsContainer.querySelectorAll('.room-section');
        sections.forEach((sec, idx) => {
            sec.querySelector('.room-num').textContent = idx + 1;
        });
        roomCount = sections.length;
    }

    addRoomBtn.addEventListener('click', () => {
        addRoom();
    });

    [outOfTownCb, forProfitCb, reductionSelect].forEach(el => {
        el.addEventListener('change', calculatePrice);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        calculatePrice();
    });

    function calculatePrice() {
        // Collect UI State Data
        const outOfTown = outOfTownCb.checked;
        const forProfit = forProfitCb.checked;
        const reductionType = reductionSelect.value;
        const sections = roomsContainer.querySelectorAll('.room-section');

        let totalBasePrice = 0;
        let totalAcPrice = 0;
        const roomDetails = [];

        sections.forEach(sec => {
            const fac = sec.querySelector('.facility-select').value;
            const acOnly = sec.querySelector('.ac-only-cb').checked;

            const slots = {};
            sec.querySelectorAll('.slot-cb:checked').forEach(cb => {
                slots[cb.value] = true;
            });

            const acOptions = {};
            sec.querySelectorAll('.ac-item').forEach(item => {
                const cb = item.querySelector('.ac-cb');
                if (cb && cb.checked) {
                    const label = cb.value;
                    const hrs = parseInt(item.querySelector('.ac-hrs').value) || 1;
                    acOptions[label] = hrs;
                }
            });

            // Local Calculation Logic (Replaces Python app.py)
            let basePrice = 0;
            if (!acOnly) {
                basePrice = calculateBasePrice(fac, slots, outOfTown, forProfit);
            }
            totalBasePrice += basePrice;

            const acPrice = calculateAcPrice(fac, acOptions);
            totalAcPrice += acPrice;

            const acDescArr = [];
            for (const [k, v] of Object.entries(acOptions)) {
                if (v > 0) {
                    acDescArr.push(`${k}(${v}h)`);
                }
            }
            const acDescStr = acDescArr.length > 0 ? acDescArr.join(" + ") : "冷暖房なし";

            roomDetails.push({
                facility: fac,
                base_price: basePrice,
                ac_price: acPrice,
                ac_desc: acDescStr
            });
        });

        const reductionRatio = REDUCTION_RATES[reductionType] || 1.0;
        const discountedBase = Math.floor(totalBasePrice * reductionRatio);
        const totalPrice = discountedBase + totalAcPrice;

        const resultData = {
            base_price: totalBasePrice,
            discounted_base: discountedBase,
            ac_price: totalAcPrice,
            total_price: totalPrice,
            room_details: roomDetails,
            details: {
                reduction_applied: reductionType
            }
        };

        renderResults(resultData);
    }

    function renderResults(data) {
        const tPriceEl = document.getElementById('total-price');
        animateValue(tPriceEl, parseInt(tPriceEl.textContent.replace(/,/g, '')) || 0, data.total_price, 500);

        const bPriceEl = document.getElementById('base-price');
        bPriceEl.textContent = data.base_price.toLocaleString();

        const discRow = document.getElementById('discount-row');
        if (data.details.reduction_applied !== "なし") {
            discRow.style.display = 'flex';
            document.getElementById('discounted-base').textContent = data.discounted_base.toLocaleString();
            bPriceEl.style.textDecoration = 'line-through';
            bPriceEl.style.opacity = '0.5';
        } else {
            discRow.style.display = 'none';
            bPriceEl.style.textDecoration = 'none';
            bPriceEl.style.opacity = '1';
        }

        document.getElementById('total-ac-price').textContent = data.ac_price.toLocaleString();

        // Render detailed breakdown
        const detailsContainer = document.getElementById('room-details-container');
        detailsContainer.innerHTML = '';

        data.room_details.forEach(rd => {
            const div = document.createElement('div');
            div.className = 'detail-item mb-3 p-2 bg-gray-50 rounded text-sm';
            div.innerHTML = `
                <div class="font-semibold text-gray-700">${rd.facility}</div>
                <div class="flex justify-between ml-2 mt-1">
                    <span>基本室料: ${rd.base_price > 0 ? rd.base_price.toLocaleString() + '円' : 'なし'}</span>
                </div>
                <div class="flex justify-between ml-2 text-blue-700">
                    <span>冷暖房費 (${rd.ac_desc !== '冷暖房なし' ? rd.ac_desc : 'なし'}): ${rd.ac_price > 0 ? rd.ac_price.toLocaleString() + '円' : '0円'}</span>
                </div>
            `;
            detailsContainer.appendChild(div);
        });
    }

    function animateValue(obj, start, end, duration) {
        if (start === end) {
            obj.innerHTML = end.toLocaleString();
            return;
        }
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
});
