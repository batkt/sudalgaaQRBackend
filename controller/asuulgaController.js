const asyncHandler = require("express-async-handler");
const excel = require("exceljs");
const Ajiltan = require("../models/ajiltan");
const Buleg = require("../models/buleg");
const xlsx = require("xlsx");

function usegTooruuKhurvuulekh(useg) {
  if (!!useg) return useg.charCodeAt() - 65;
  else return 0;
}

function toogUsegruuKhurvuulekh(too) {
  if (!!too) {
    if (too < 26) return String.fromCharCode(too + 65);
    else {
      var orongiinToo = Math.floor(too / 26);
      var uldegdel = too % 26;
      return (
        String.fromCharCode(orongiinToo + 64) +
        String.fromCharCode(uldegdel + 65)
      );
    }
  } else return 0;
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

// Helper function to find department in nested structure and return path info
async function findDepartmentPathInHierarchy(
  departmentPath,
  hierarchy,
  currentLevel = 0
) {
  if (!departmentPath || !hierarchy || departmentPath.length === 0) return [];

  let currentDeptName, remainingPath;

  try {
    currentDeptName =
      departmentPath[0] && typeof departmentPath[0] === "string"
        ? departmentPath[0].trim()
        : String(departmentPath[0] || "").trim();
    remainingPath = departmentPath.slice(1);

    console.log(`Searching for: "${currentDeptName}" at level ${currentLevel}`);
    console.log(
      `Available departments at this level:`,
      hierarchy.map((d) => d.ner)
    );
  } catch (error) {
    console.error("Error in findDepartmentPathInHierarchy:", error);
    console.error(
      "departmentPath[0]:",
      departmentPath[0],
      "type:",
      typeof departmentPath[0]
    );
    return [];
  }

  // Search in current level with fuzzy matching
  for (const dept of hierarchy) {
    // Ensure dept.ner is a string before calling trim
    const deptName =
      dept.ner && typeof dept.ner === "string"
        ? dept.ner.trim()
        : String(dept.ner || "").trim();

    // Exact match
    if (deptName === currentDeptName) {
      console.log(`Found exact match: ${deptName}`);
      const result = [
        {
          level: currentLevel,
          departmentId: dept._id,
          departmentName: dept.ner,
        },
      ];

      // If there are more levels to search, continue in nested structure
      if (
        remainingPath.length > 0 &&
        dept.dedKhesguud &&
        dept.dedKhesguud.length > 0
      ) {
        const nestedResult = await findDepartmentPathInHierarchy(
          remainingPath,
          dept.dedKhesguud,
          currentLevel + 1
        );
        return result.concat(nestedResult);
      }

      return result;
    }

    // Fuzzy match (contains) - only if both are strings
    if (typeof deptName === "string" && typeof currentDeptName === "string") {
      if (
        deptName.toLowerCase().includes(currentDeptName.toLowerCase()) ||
        currentDeptName.toLowerCase().includes(deptName.toLowerCase())
      ) {
        console.log(
          `Found fuzzy match: "${deptName}" for "${currentDeptName}"`
        );
        const result = [
          {
            level: currentLevel,
            departmentId: dept._id,
            departmentName: dept.ner,
          },
        ];

        // If there are more levels to search, continue in nested structure
        if (
          remainingPath.length > 0 &&
          dept.dedKhesguud &&
          dept.dedKhesguud.length > 0
        ) {
          const nestedResult = await findDepartmentPathInHierarchy(
            remainingPath,
            dept.dedKhesguud,
            currentLevel + 1
          );
          return result.concat(nestedResult);
        }

        return result;
      }
    }
  }

  console.log(
    `No match found for: "${currentDeptName}" at level ${currentLevel}`
  );
  return [];
}

// Helper function to get all departments in a flat structure for easy searching
async function getAllDepartmentsFlat() {
  const allDepartments = await Buleg.find({});
  const flatDepartments = [];

  function flattenDepartments(departments, level = 0) {
    for (const dept of departments) {
      flatDepartments.push({
        _id: dept._id,
        ner:
          dept.ner && typeof dept.ner === "string"
            ? dept.ner
            : String(dept.ner || ""),
        desDugaar:
          dept.desDugaar && typeof dept.desDugaar === "string"
            ? dept.desDugaar
            : String(dept.desDugaar || ""),
        level: level,
      });

      if (dept.dedKhesguud && dept.dedKhesguud.length > 0) {
        flattenDepartments(dept.dedKhesguud, level + 1);
      }
    }
  }

  flattenDepartments(allDepartments);
  return flatDepartments;
}

exports.ajiltanTatya = asyncHandler(async (req, res, next) => {
  try {
    const workbook = xlsx.read(req.file.buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jagsaalt = [];
    var tolgoinObject = {};
    var data = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      range: 1,
    });

    if (workbook.SheetNames[0] != "Ажилтан")
      throw new Error("Буруу файл байна!");

    // Required basic fields
    const requiredFields = [
      "Овог",
      "Нэр",
      "Регистр",
      "Хувийн дугаар",
      "Утас",
      "Нэр дуудлага",
    ];
    const missingFields = requiredFields.filter(
      (field) =>
        !Object.values(worksheet).some(
          (cell) => cell.v && cell.v.toString().includes(field)
        )
    );

    if (missingFields.length > 0) {
      throw new Error(
        `Та загварын дагуу бөглөөгүй байна! Дутуу талбар: ${missingFields.join(
          ", "
        )}`
      );
    }

    // Get all departments for mapping
    const allDepartments = await Buleg.find({});

    // Map column headers to column letters
    for (let cell in worksheet) {
      const cellAsString = cell.toString();
      if (
        cellAsString[1] === "1" &&
        cellAsString.length == 2 &&
        !!worksheet[cellAsString].v
      ) {
        const headerValue = worksheet[cellAsString].v.toString();

        // Map basic employee fields
        if (headerValue.includes("Овог")) tolgoinObject.ovog = cellAsString[0];
        else if (
          headerValue.includes("Нэр") &&
          !headerValue.includes("дуудлага")
        )
          tolgoinObject.ner = cellAsString[0];
        else if (headerValue.includes("Регистр"))
          tolgoinObject.register = cellAsString[0];
        else if (headerValue.includes("Хувийн дугаар"))
          tolgoinObject.nevtrekhNer = cellAsString[0];
        else if (headerValue.includes("Утас"))
          tolgoinObject.utas = cellAsString[0];
        else if (headerValue.includes("Нэр дуудлага"))
          tolgoinObject.porool = cellAsString[0];
        else if (headerValue.includes("Зургийн ID"))
          tolgoinObject.zurgiinId = cellAsString[0];
        // Map department fields dynamically
        else if (
          headerValue.includes("Хэсэг") ||
          headerValue.includes("Департамент")
        ) {
          if (!tolgoinObject.departments) tolgoinObject.departments = [];
          tolgoinObject.departments.push({
            column: cellAsString[0],
            name: headerValue,
          });
        }
      }
    }

    var aldaaniiMsg = "";
    var muriinDugaar = 1;

    for await (const mur of data) {
      muriinDugaar++;

      // Skip empty rows
      if (
        !mur[usegTooruuKhurvuulekh(tolgoinObject.ner)] &&
        !mur[usegTooruuKhurvuulekh(tolgoinObject.register)]
      ) {
        continue;
      }

      let object = new Ajiltan();

      // Set basic employee information
      object.ovog = mur[usegTooruuKhurvuulekh(tolgoinObject.ovog)];
      object.ner = mur[usegTooruuKhurvuulekh(tolgoinObject.ner)];
      object.register = mur[usegTooruuKhurvuulekh(tolgoinObject.register)];
      object.utas = mur[usegTooruuKhurvuulekh(tolgoinObject.utas)];
      object.nevtrekhNer =
        mur[usegTooruuKhurvuulekh(tolgoinObject.nevtrekhNer)];
      object.porool = mur[usegTooruuKhurvuulekh(tolgoinObject.porool)];
      object.zurgiinId = mur[usegTooruuKhurvuulekh(tolgoinObject.zurgiinId)];
      object.nuutsUg = "123";

      // Process department assignments
      const departmentPath = [];
      if (tolgoinObject.departments) {
        for (const dept of tolgoinObject.departments) {
          const deptName = mur[usegTooruuKhurvuulekh(dept.column)];
          if (
            deptName &&
            typeof deptName === "string" &&
            deptName.trim() !== ""
          ) {
            departmentPath.push(deptName.trim());
          } else if (deptName && typeof deptName !== "string") {
            // Convert non-string to string and trim
            const stringDeptName = String(deptName).trim();
            if (stringDeptName !== "") {
              departmentPath.push(stringDeptName);
            }
          }
        }
      }

      // Find department assignments in hierarchy
      if (departmentPath.length > 0) {
        const departmentAssignments = await findDepartmentPathInHierarchy(
          departmentPath,
          allDepartments
        );
        object.departmentAssignments = departmentAssignments;

        if (departmentAssignments.length === 0) {
          aldaaniiMsg += `Мөр ${muriinDugaar}: Хэсгийн зам олдсонгүй: ${departmentPath.join(
            " > "
          )}\n`;
        }
      }

      jagsaalt.push(object);
    }

    if (aldaaniiMsg) {
      console.log("Алдаанууд:", aldaaniiMsg);
    }

    Ajiltan.insertMany(jagsaalt)
      .then((result) => {
        res.status(200).json({
          success: true,
          message: "Амжилттай импорт хийгдлээ",
          imported: result.length,
          errors: aldaaniiMsg || null,
        });
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

exports.ajiltanZagvarAvya = asyncHandler(async (req, res, next) => {
  try {
    let workbook = new excel.Workbook();
    let worksheet = workbook.addWorksheet("Ажилтан");

    // Get department hierarchy to create dynamic columns
    const allDepartments = await Buleg.find({});
    const flatDepartments = await getAllDepartmentsFlat();

    // Create basic employee columns
    var baganuud = [
      {
        header: "Овог",
        key: "Овог",
        width: 20,
      },
      {
        header: "Нэр",
        key: "Нэр",
        width: 20,
      },
      {
        header: "Регистр",
        key: "Регистр",
        width: 20,
      },
      {
        header: "Хувийн дугаар",
        key: "Хувийн дугаар",
        width: 20,
      },
      {
        header: "Утас",
        key: "Утас",
        width: 20,
      },
      {
        header: "Нэр дуудлага",
        key: "Нэр дуудлага",
        width: 20,
      },
      {
        header: "Зургийн ID",
        key: "Зургийн ID",
        width: 20,
      },
    ];

    // Add dynamic department columns based on hierarchy levels
    const maxLevel = Math.max(...flatDepartments.map((dept) => dept.level));
    for (let level = 0; level <= maxLevel; level++) {
      baganuud.push({
        header: `Хэсэг ${level + 1}`,
        key: `Хэсэг ${level + 1}`,
        width: 25,
      });
    }

    worksheet.columns = baganuud;

    // Add instruction row
    worksheet.addRow([
      "Зааварчилгаа:",
      "1. Хэсгийн багана нь иерархийн дарааллаар бөглөнө үү (жишээ: 1.1, 1.2, 1.3)",
      "2. Хэрэв ажилтан цөөн түвшинд байвал үлдсэн баганыг хоосон үлдээнэ үү",
      "3. Бүх заавал бөглөх талбарыг бөглөнө үү",
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=ajiltan_template.xlsx"
    );

    return workbook.xlsx.write(res).then(function () {
      res.status(200).end();
    });
  } catch (error) {
    next(error);
  }
});

// Get department hierarchy structure
exports.getDepartmentHierarchy = asyncHandler(async (req, res, next) => {
  try {
    const allDepartments = await Buleg.find({});
    res.status(200).json({
      success: true,
      data: allDepartments,
    });
  } catch (error) {
    next(error);
  }
});

// Get flat department list for easy selection
exports.getDepartmentsFlat = asyncHandler(async (req, res, next) => {
  try {
    const flatDepartments = await getAllDepartmentsFlat();
    res.status(200).json({
      success: true,
      data: flatDepartments,
    });
  } catch (error) {
    next(error);
  }
});

// Get available department templates for Excel download
exports.getDepartmentTemplates = asyncHandler(async (req, res, next) => {
  try {
    const allDepartments = await Buleg.find({});
    const flatDepartments = await getAllDepartmentsFlat();

    // Group departments by their root level to create templates
    const templates = [];

    for (const rootDept of allDepartments) {
      const template = {
        id: rootDept._id,
        name: rootDept.ner,
        description: `Template for ${rootDept.ner} department structure`,
        maxLevel: 0,
        departmentCount: 0,
      };

      // Calculate max level and department count for this template
      function calculateTemplateInfo(departments, level = 0) {
        template.maxLevel = Math.max(template.maxLevel, level);
        template.departmentCount++;

        if (departments.dedKhesguud && departments.dedKhesguud.length > 0) {
          for (const subDept of departments.dedKhesguud) {
            calculateTemplateInfo(subDept, level + 1);
          }
        }
      }

      calculateTemplateInfo(rootDept);
      templates.push(template);
    }

    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
});

// Download Excel template for specific department structure
exports.downloadDepartmentTemplate = asyncHandler(async (req, res, next) => {
  try {
    const { departmentId } = req.params;

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: "Department ID is required",
      });
    }

    // Find the specific department and its hierarchy
    const department = await Buleg.findById(departmentId);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    // Get flat structure for this department
    const flatDepartments = [];
    function flattenDepartment(dept, level = 0) {
      flatDepartments.push({
        _id: dept._id,
        ner:
          dept.ner && typeof dept.ner === "string"
            ? dept.ner
            : String(dept.ner || ""),
        level: level,
      });

      if (dept.dedKhesguud && dept.dedKhesguud.length > 0) {
        for (const subDept of dept.dedKhesguud) {
          flattenDepartment(subDept, level + 1);
        }
      }
    }

    flattenDepartment(department);
    const maxLevel = Math.max(...flatDepartments.map((d) => d.level));

    let workbook = new excel.Workbook();
    let worksheet = workbook.addWorksheet("Ажилтан");

    // Create basic employee columns
    var baganuud = [
      {
        header: "Овог",
        key: "Овог",
        width: 20,
      },
      {
        header: "Нэр",
        key: "Нэр",
        width: 20,
      },
      {
        header: "Регистр",
        key: "Регистр",
        width: 20,
      },
      {
        header: "Хувийн дугаар",
        key: "Хувийн дугаар",
        width: 20,
      },
      {
        header: "Утас",
        key: "Утас",
        width: 20,
      },
      {
        header: "Нэр дуудлага",
        key: "Нэр дуудлага",
        width: 20,
      },
      {
        header: "Зургийн ID",
        key: "Зургийн ID",
        width: 20,
      },
    ];

    // Add dynamic department columns based on this department's hierarchy
    for (let level = 0; level <= maxLevel; level++) {
      baganuud.push({
        header: `Хэсэг ${level + 1}`,
        key: `Хэсэг ${level + 1}`,
        width: 25,
      });
    }

    worksheet.columns = baganuud;

    // Add instruction row with department-specific info
    worksheet.addRow([
      "Зааварчилгаа:",
      `1. Энэ загвар нь "${department.ner}" хэсгийн бүтцийн дагуу бэлтгэгдсэн`,
      `2. Хэсгийн багана нь иерархийн дарааллаар бөглөнө үү`,
      `3. Хэрэв ажилтан цөөн түвшинд байвал үлдсэн баганыг хоосон үлдээнэ үү`,
      `4. Бүх заавал бөглөх талбарыг бөглөнө үү`,
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${department.ner}_template.xlsx`
    );

    return workbook.xlsx.write(res).then(function () {
      res.status(200).end();
    });
  } catch (error) {
    next(error);
  }
});

// Debug endpoint to test department matching
exports.debugDepartmentMatching = asyncHandler(async (req, res, next) => {
  try {
    const { departmentPath } = req.body;

    if (!departmentPath || !Array.isArray(departmentPath)) {
      return res.status(400).json({
        success: false,
        message: "Please provide departmentPath as an array",
      });
    }

    const allDepartments = await Buleg.find({});
    const flatDepartments = await getAllDepartmentsFlat();

    console.log("Testing department path:", departmentPath);
    console.log(
      "Available departments:",
      flatDepartments.map((d) => ({ name: d.ner, level: d.level }))
    );

    const result = await findDepartmentPathInHierarchy(
      departmentPath,
      allDepartments
    );

    res.status(200).json({
      success: true,
      data: {
        inputPath: departmentPath,
        foundPath: result,
        availableDepartments: flatDepartments,
        allHierarchy: allDepartments,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Export employees with department information
exports.ajiltanExport = asyncHandler(async (req, res, next) => {
  try {
    const employees = await Ajiltan.findWithDepartments();
    const flatDepartments = await getAllDepartmentsFlat();
    const maxLevel = Math.max(...flatDepartments.map((dept) => dept.level));

    let workbook = new excel.Workbook();
    let worksheet = workbook.addWorksheet("Ажилтан");

    // Create headers
    const headers = [
      "Овог",
      "Нэр",
      "Регистр",
      "Хувийн дугаар",
      "Утас",
      "Нэр дуудлага",
      "Зургийн ID",
    ];

    // Add dynamic department headers
    for (let level = 0; level <= maxLevel; level++) {
      headers.push(`Хэсэг ${level + 1}`);
    }

    worksheet.addRow(headers);

    // Add employee data
    employees.forEach((employee) => {
      const row = [
        employee.ovog,
        employee.ner,
        employee.register,
        employee.nevtrekhNer,
        employee.utas,
        employee.porool,
        employee.zurgiinId,
      ];

      // Add department information
      const departmentPath = employee.departmentAssignments
        .sort((a, b) => a.level - b.level)
        .map((dept) => dept.departmentName);

      // Fill department columns
      for (let level = 0; level <= maxLevel; level++) {
        row.push(departmentPath[level] || "");
      }

      worksheet.addRow(row);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=ajiltanuud.xlsx"
    );

    return workbook.xlsx.write(res).then(function () {
      res.status(200).end();
    });
  } catch (error) {
    next(error);
  }
});

exports.ajiltanNemekh = asyncHandler(async (req, res, next) => {
  try {
    const {
      departmentPath, // Array of department names in hierarchy order: ["1.1", "1.2", "1.3", ...]
      ovog,
      ner,
      register,
      utas,
      nevtrekhNer,
      porool,
      zurgiinId,
    } = req.body;

    const existingEmployee = await Ajiltan.findOne({ register });
    if (existingEmployee) {
      throw new Error("Энэ регистрийн дугаартай ажилтан бүртгэгдсэн байна!");
    }

    const existingUsername = await Ajiltan.findOne({ nevtrekhNer });
    if (existingUsername) {
      throw new Error("Энэ нэвтрэх нэртэй ажилтан бүртгэгдсэн байна!");
    }

    // Get all departments to search through hierarchy
    const allDepartments = await Buleg.find({});

    // Find department path in hierarchy
    const departmentAssignments = await findDepartmentPathInHierarchy(
      departmentPath,
      allDepartments
    );

    if (departmentAssignments.length === 0) {
      throw new Error("Хэсэг олдсонгүй! Зөв хэсгийн нэрүүдийг оруулна уу.");
    }

    const newEmployee = new Ajiltan({
      departmentAssignments,
      ovog,
      ner,
      register,
      utas,
      nevtrekhNer,
      porool,
      zurgiinId,
      nuutsUg: "123",
    });

    const savedEmployee = await newEmployee.save();

    // Populate department information for response
    const populatedEmployee = await savedEmployee.populateDepartments();

    res.status(201).json({
      success: true,
      message: "Ажилтан амжилттай бүртгэгдлээ",
      data: populatedEmployee,
    });
  } catch (error) {
    next(error);
  }
});
