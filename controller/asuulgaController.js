const asyncHandler = require("express-async-handler");
const excel = require("exceljs");
const Ajiltan = require("../models/ajiltan");
const Buleg = require("../models/buleg");
const xlsx = require("xlsx");

// Helper functions
function usegTooruuKhurvuulekh(useg) {
  if (!!useg) return useg.charCodeAt() - 65;
  else return 0;
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

// Safe string trim function
function safeTrim(value) {
  if (value && typeof value === "string") return value.trim();
  return String(value || "").trim();
}

// Find department in hierarchy
async function findDepartmentPath(departmentPath, hierarchy, currentLevel = 0) {
  if (!departmentPath || !hierarchy || departmentPath.length === 0) return [];

  const currentDeptName = safeTrim(departmentPath[0]);
  const remainingPath = departmentPath.slice(1);

  for (const dept of hierarchy) {
    const deptName = safeTrim(dept.ner);

    if (deptName === currentDeptName) {
      const result = [
        {
          level: currentLevel,
          departmentId: dept._id,
          departmentName: dept.ner,
        },
      ];

      if (
        remainingPath.length > 0 &&
        dept.dedKhesguud &&
        dept.dedKhesguud.length > 0
      ) {
        const nestedResult = await findDepartmentPath(
          remainingPath,
          dept.dedKhesguud,
          currentLevel + 1
        );
        return result.concat(nestedResult);
      }

      return result;
    }
  }

  return [];
}

// Get flat department list
async function getFlatDepartments() {
  const allDepartments = await Buleg.find({});
  const flatDepartments = [];

  function flatten(dept, level = 0) {
    flatDepartments.push({
      _id: dept._id,
      ner: safeTrim(dept.ner),
      level: level,
    });

    if (dept.dedKhesguud && dept.dedKhesguud.length > 0) {
      for (const subDept of dept.dedKhesguud) {
        flatten(subDept, level + 1);
      }
    }
  }

  allDepartments.forEach((dept) => flatten(dept));
  return flatDepartments;
}

// Excel Import
exports.ajiltanTatya = asyncHandler(async (req, res, next) => {
  try {
    const workbook = xlsx.read(req.file.buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, range: 1 });

    if (workbook.SheetNames[0] !== "Ажилтан") {
      throw new Error("Буруу файл байна!");
    }

    // Map column headers
    const columnMap = {};
    const allDepartments = await Buleg.find({});
    const departmentHierarchy =
      getDepartmentHierarchyForTemplate(allDepartments);

    for (let cell in worksheet) {
      const cellStr = cell.toString();
      if (cellStr[1] === "1" && cellStr.length === 2 && worksheet[cellStr].v) {
        const header = worksheet[cellStr].v.toString();
        const column = cellStr[0];

        if (header.includes("Овог")) columnMap.ovog = column;
        else if (header.includes("Нэр") && !header.includes("дуудлага"))
          columnMap.ner = column;
        else if (header.includes("Регистр")) columnMap.register = column;
        else if (header.includes("Хувийн дугаар"))
          columnMap.nevtrekhNer = column;
        else if (header.includes("Утас")) columnMap.utas = column;
        else {
          const matchingDept = departmentHierarchy.find(
            (dept) => dept.name === header
          );
          if (matchingDept) {
            if (!columnMap.departments) columnMap.departments = [];
            columnMap.departments.push({
              column,
              name: header,
              deptId: matchingDept._id,
            });
          }
        }
      }
    }

    const employees = [];
    let errors = "";

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      if (
        !row[usegTooruuKhurvuulekh(columnMap.ner)] &&
        !row[usegTooruuKhurvuulekh(columnMap.register)]
      ) {
        continue;
      }

      const employee = new Ajiltan({
        ovog: row[usegTooruuKhurvuulekh(columnMap.ovog)],
        ner: row[usegTooruuKhurvuulekh(columnMap.ner)],
        register: row[usegTooruuKhurvuulekh(columnMap.register)],
        utas: row[usegTooruuKhurvuulekh(columnMap.utas)],
        nevtrekhNer: row[usegTooruuKhurvuulekh(columnMap.nevtrekhNer)],
        porool: row[usegTooruuKhurvuulekh(columnMap.porool)],
        zurgiinId: row[usegTooruuKhurvuulekh(columnMap.zurgiinId)],
        nuutsUg: "123",
      });

      // Process department assignments
      if (columnMap.departments) {
        const departmentPath = [];
        for (const dept of columnMap.departments) {
          const deptName = row[usegTooruuKhurvuulekh(dept.column)];
          if (deptName && safeTrim(deptName) !== "") {
            departmentPath.push(safeTrim(deptName));
          }
        }

        if (departmentPath.length > 0) {
          const assignments = await findDepartmentPath(
            departmentPath,
            allDepartments
          );
          employee.departmentAssignments = assignments;

          if (assignments.length === 0) {
            errors += `Мөр ${
              i + 2
            }: Хэсгийн зам олдсонгүй: ${departmentPath.join(" > ")}\n`;
          }
        }
      }

      employees.push(employee);
    }

    const result = await Ajiltan.insertMany(employees);

    res.status(200).json({
      success: true,
      message: "Амжилттай импорт хийгдлээ",
      imported: result.length,
      errors: errors || null,
    });
  } catch (error) {
    next(error);
  }
});

// Get department hierarchy for template
function getDepartmentHierarchyForTemplate(departments, level = 0) {
  const hierarchy = [];

  for (const dept of departments) {
    hierarchy.push({
      name: dept.ner,
      level: level,
      _id: dept._id,
    });

    if (dept.dedKhesguud && dept.dedKhesguud.length > 0) {
      const subHierarchy = getDepartmentHierarchyForTemplate(
        dept.dedKhesguud,
        level + 1
      );
      hierarchy.push(...subHierarchy);
    }
  }

  return hierarchy;
}

// Excel Template Download
exports.ajiltanZagvarAvya = asyncHandler(async (req, res, next) => {
  try {
    const allDepartments = await Buleg.find({});
    const departmentHierarchy =
      getDepartmentHierarchyForTemplate(allDepartments);

    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet("Ажилтан");

    const columns = [
      { header: "Овог", key: "Овог", width: 20 },
      { header: "Нэр", key: "Нэр", width: 20 },
      { header: "Регистр", key: "Регистр", width: 20 },
      { header: "Хувийн дугаар", key: "Хувийн дугаар", width: 20 },
      { header: "Утас", key: "Утас", width: 20 },
    ];

    // Add department columns based on actual hierarchy
    departmentHierarchy.forEach((dept, index) => {
      columns.push({
        header: dept.name,
        key: `dept_${index}`,
        width: 25,
      });
    });

    worksheet.columns = columns;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=ajiltan_template.xlsx"
    );

    return workbook.xlsx.write(res).then(() => res.status(200).end());
  } catch (error) {
    next(error);
  }
});

// Create Employee
exports.ajiltanNemekh = asyncHandler(async (req, res, next) => {
  try {
    const {
      departmentPath,
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

    const allDepartments = await Buleg.find({});
    const departmentAssignments = await findDepartmentPath(
      departmentPath,
      allDepartments
    );

    if (departmentPath.length > 0 && departmentAssignments.length === 0) {
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

// Get Department Hierarchy
exports.getDepartmentHierarchy = asyncHandler(async (req, res, next) => {
  try {
    const allDepartments = await Buleg.find({});
    res.status(200).json({ success: true, data: allDepartments });
  } catch (error) {
    next(error);
  }
});

// Get Flat Departments
exports.getDepartmentsFlat = asyncHandler(async (req, res, next) => {
  try {
    const flatDepartments = await getFlatDepartments();
    res.status(200).json({ success: true, data: flatDepartments });
  } catch (error) {
    next(error);
  }
});

// Get Department Templates
exports.getDepartmentTemplates = asyncHandler(async (req, res, next) => {
  try {
    const allDepartments = await Buleg.find({});
    const templates = allDepartments.map((dept) => ({
      id: dept._id,
      name: dept.ner,
      description: `${dept.ner} хэсгийн загвар`,
    }));

    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
});

// Download Department Template
exports.downloadDepartmentTemplate = asyncHandler(async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const department = await Buleg.findById(departmentId);

    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Хэсэг олдсонгүй" });
    }

    // Get hierarchy for this specific department
    const departmentHierarchy = getDepartmentHierarchyForTemplate([department]);

    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet("Ажилтан");

    const columns = [
      { header: "Овог", key: "Овог", width: 20 },
      { header: "Нэр", key: "Нэр", width: 20 },
      { header: "Регистр", key: "Регистр", width: 20 },
      { header: "Хувийн дугаар", key: "Хувийн дугаар", width: 20 },
      { header: "Утас", key: "Утас", width: 20 },
    ];

    // Add department columns based on actual hierarchy
    departmentHierarchy.forEach((dept, index) => {
      columns.push({
        header: dept.name,
        key: `dept_${index}`,
        width: 25,
      });
    });

    worksheet.columns = columns;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${department.ner}_template.xlsx`
    );

    return workbook.xlsx.write(res).then(() => res.status(200).end());
  } catch (error) {
    next(error);
  }
});

// Export Employees
exports.ajiltanExport = asyncHandler(async (req, res, next) => {
  try {
    const employees = await Ajiltan.findWithDepartments();
    const flatDepartments = await getFlatDepartments();
    const maxLevel = Math.max(...flatDepartments.map((d) => d.level));

    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet("Ажилтан");

    const headers = ["Овог", "Нэр", "Регистр", "Хувийн дугаар", "Утас"];
    for (let level = 0; level <= maxLevel; level++) {
      headers.push(`Хэсэг ${level + 1}`);
    }

    worksheet.addRow(headers);

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

      const departmentPath = employee.departmentAssignments
        .sort((a, b) => a.level - b.level)
        .map((dept) => dept.departmentName);

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

    return workbook.xlsx.write(res).then(() => res.status(200).end());
  } catch (error) {
    next(error);
  }
});
