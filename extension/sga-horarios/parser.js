(() => {
  "use strict";

  const DAY_NAMES = {
    lunes: "MONDAY",
    martes: "TUESDAY",
    miercoles: "WEDNESDAY",
    jueves: "THURSDAY",
    viernes: "FRIDAY",
    sabado: "SATURDAY",
    domingo: "SUNDAY",
  };

  function compact(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function comparable(value) {
    return compact(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es");
  }

  function toInteger(value) {
    const match = compact(value).match(/-?\d+/);
    return match ? Number(match[0]) : null;
  }

  function parseCourseLabel(value) {
    const text = compact(value);
    const match = text.match(/^(\d{2}\.\d{2})\s*-\s*(.+)$/i);
    if (!match) return null;
    const creditMatch = match[2].match(/\s*\((\d+)\s*Cr[eé]ditos?\)\s*$/i);
    return {
      courseId: match[1],
      courseName: compact(creditMatch ? match[2].slice(0, creditMatch.index) : match[2]),
      credits: creditMatch ? Number(creditMatch[1]) : null,
    };
  }

  function parseAcademicPeriod(root = document) {
    const text = compact(root.body?.innerText || root.documentElement?.textContent);
    const match = text.match(/Matriculaci[oó]n\s+(Primer|Segundo|1(?:er|°)?|2(?:do|°)?)\s+Cuat\.?\s*(20\d{2})/i);
    if (!match) return null;
    return {
      year: Number(match[2]),
      period: comparable(match[1]).startsWith("segundo") || match[1].startsWith("2") ? 2 : 1,
      label: `${match[1]} Cuat. ${match[2]}`,
    };
  }

  function tableHeaders(table) {
    const firstRow = table.querySelector("tr");
    return firstRow
      ? [...firstRow.querySelectorAll("th, td")].map((cell) => comparable(cell.innerText || cell.textContent))
      : [];
  }

  function headerIndex(headers, expected) {
    const target = comparable(expected);
    return headers.findIndex((header) => header === target || header.includes(target));
  }

  function matchingTables(root, requiredHeaders) {
    return [...root.querySelectorAll("table")].filter((table) => {
      const headers = tableHeaders(table);
      return requiredHeaders.every((required) => headerIndex(headers, required) >= 0);
    });
  }

  function dataRows(table) {
    return [...table.querySelectorAll("tr")].filter((row, index) => index > 0 && row.querySelectorAll("td").length > 0);
  }

  function parseAvailableCourses(root = document) {
    const courses = [];
    for (const table of matchingTables(root, ["Materia", "Matricular"])) {
      const headers = tableHeaders(table);
      const courseIndex = headerIndex(headers, "Materia");
      for (const row of dataRows(table)) {
        const cells = [...row.querySelectorAll("td")];
        const parsed = parseCourseLabel(cells[courseIndex]?.innerText || cells[courseIndex]?.textContent);
        if (!parsed || courses.some((course) => course.courseId === parsed.courseId)) continue;
        courses.push(parsed);
      }
    }
    return courses;
  }

  function inferBuilding(value) {
    const text = comparable(value);
    if (text.includes("distrito financiero")) return "SDF";
    if (text.includes("distrito tecnologico")) return "SDT";
    if (text.includes("rectorado") || text.includes("madero")) return "SDR";
    if (text.includes("virtual") || text.includes("online")) return "Online";
    return "";
  }

  function parseMeetings(value) {
    const raw = compact(value);
    const dayPattern = /(Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo)\s*\(?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*\)?/gi;
    const matches = [...raw.matchAll(dayPattern)];

    return matches.map((match, index) => {
      const segment = raw.slice(match.index, matches[index + 1]?.index ?? raw.length);
      const roomMatch = segment.match(/Aula\s+ITBA:\s*([^#|]+?)(?=\s*#|\s*\||$)/i);
      const externalRoomMatch = segment.match(/Aula\s+externa:\s*([^|]+?)(?=\s*\||$)/i);
      const normalizedDay = comparable(match[1]);
      return {
        day: DAY_NAMES[normalizedDay] || normalizedDay.toUpperCase(),
        time_from: `${match[2]}:00`,
        time_to: `${match[3]}:00`,
        classroom: compact(roomMatch?.[1] || externalRoomMatch?.[1] || ""),
        building: inferBuilding(segment),
        raw: compact(segment.replace(/^\|\s*/, "").replace(/\|\s*$/, "")),
      };
    });
  }

  function parseRequestedCourses(root = document) {
    const courses = [];
    for (const table of matchingTables(root, ["Materia", "Comisión", "Horarios", "Dar de baja"])) {
      const headers = tableHeaders(table);
      const courseIndex = headerIndex(headers, "Materia");
      const creditsIndex = headerIndex(headers, "Créditos");
      const commissionIndex = headerIndex(headers, "Comisión");
      const scheduleIndex = headerIndex(headers, "Horarios");
      for (const row of dataRows(table)) {
        const cells = [...row.querySelectorAll("td")];
        const parsed = parseCourseLabel(cells[courseIndex]?.innerText || cells[courseIndex]?.textContent);
        if (!parsed) continue;
        const scheduleText = compact(cells[scheduleIndex]?.innerText || cells[scheduleIndex]?.textContent);
        courses.push({
          ...parsed,
          credits: parsed.credits ?? toInteger(cells[creditsIndex]?.innerText || cells[creditsIndex]?.textContent),
          availability: "requested",
          commissions: [{
            name: compact(cells[commissionIndex]?.innerText || cells[commissionIndex]?.textContent),
            applicants: null,
            availableSeats: null,
            rawSchedule: scheduleText,
            meetings: parseMeetings(scheduleText),
          }],
        });
      }
    }
    return courses;
  }

  function detailHeading(root = document) {
    const headings = [...root.querySelectorAll("h1, h2, h3, h4, .page-header, .titulo")];
    for (const heading of headings) {
      const text = compact(heading.innerText || heading.textContent);
      const match = text.match(/Materia:\s*(\d{2}\.\d{2})\s*-\s*(.+)$/i);
      if (match) return { courseId: match[1], courseName: compact(match[2]) };
    }
    return null;
  }

  function parseCourseDetail(root = document) {
    const course = detailHeading(root);
    const table = matchingTables(root, ["Selección", "Comisión", "Horarios"])[0];
    if (!course || !table) return null;
    const headers = tableHeaders(table);
    const commissionIndex = headerIndex(headers, "Comisión");
    const applicantsIndex = headerIndex(headers, "Solicitantes");
    const seatsIndex = headerIndex(headers, "Cupo disponible");
    const scheduleIndex = headerIndex(headers, "Horarios");
    const commissions = [];

    for (const row of dataRows(table)) {
      const cells = [...row.querySelectorAll("td")];
      const name = compact(cells[commissionIndex]?.innerText || cells[commissionIndex]?.textContent);
      if (!name) continue;
      const scheduleText = compact(cells[scheduleIndex]?.innerText || cells[scheduleIndex]?.textContent);
      commissions.push({
        name,
        applicants: applicantsIndex >= 0 ? toInteger(cells[applicantsIndex]?.innerText || cells[applicantsIndex]?.textContent) : null,
        availableSeats: seatsIndex >= 0 ? toInteger(cells[seatsIndex]?.innerText || cells[seatsIndex]?.textContent) : null,
        rawSchedule: scheduleText,
        meetings: parseMeetings(scheduleText),
      });
    }
    return { ...course, commissions };
  }

  function hasShowAllOrientations(root = document) {
    return [...root.querySelectorAll("a, button")].some((element) =>
      comparable(element.innerText || element.textContent).includes("mostrar los cursos de todas las orientaciones"),
    );
  }

  function classifyPage(root = document) {
    const detail = parseCourseDetail(root);
    if (detail) return { kind: "detail", course: detail, academicPeriod: parseAcademicPeriod(root) };
    const availableCourses = parseAvailableCourses(root);
    if (availableCourses.length > 0 || comparable(root.body?.innerText).includes("materias de grado disponibles")) {
      return {
        kind: "list",
        academicPeriod: parseAcademicPeriod(root),
        availableCourses,
        requestedCourses: parseRequestedCourses(root),
        canExpandOrientations: hasShowAllOrientations(root),
      };
    }
    return { kind: "unknown", academicPeriod: parseAcademicPeriod(root) };
  }

  globalThis.SgaParser = {
    classifyPage,
    compact,
    comparable,
    parseAcademicPeriod,
    parseAvailableCourses,
    parseCourseDetail,
    parseCourseLabel,
    parseMeetings,
    parseRequestedCourses,
  };
})();
