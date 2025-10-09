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

// Check if a column contains department-like data
function checkIfDepartmentColumn(worksheet, column, data) {
  // Get sample values from the first few rows of this column
  const sampleValues = [];
  for (let i = 1; i < Math.min(6, data.length); i++) {
    // Check first 5 data rows
    const cellValue = data[i][usegTooruuKhurvuulekh(column)];
    if (cellValue && String(cellValue).trim() !== "") {
      sampleValues.push(String(cellValue).trim());
    }
  }

  console.log(`Column ${column} sample values:`, sampleValues);

  if (sampleValues.length === 0) {
    console.log(`Column ${column}: No sample values found`);
    return false;
  }

  // Check if values look like department names or hierarchical identifiers
  const departmentPatterns = [
    /^\d+\.\d+/, // Pattern like "1.1", "2.3", etc.
    /^\d+\.\d+\.\d+/, // Pattern like "1.1.1", "2.3.4", etc.
    /^\d+-р түвшин/, // Pattern like "1-р түвшин", "2-р түвшин", etc.
    /^[A-Z]\d+/, // Pattern like "A1", "B2", etc.
    /^\d+[A-Z]/, // Pattern like "1A", "2B", etc.
    /^[А-Я]/, // Mongolian Cyrillic characters
    /^[A-Za-z]/, // English letters
    /^\d+$/, // Simple numbers like "1", "2", "3"
    /^[A-Za-z0-9]+$/, // Alphanumeric strings
  ];

  // Check if at least 60% of sample values match department patterns
  const matchingValues = sampleValues.filter((value) =>
    departmentPatterns.some((pattern) => pattern.test(value))
  );

  const isDepartment =
    matchingValues.length >= Math.ceil(sampleValues.length * 0.6);
  console.log(
    `Column ${column}: ${matchingValues.length}/${sampleValues.length} match, isDepartment: ${isDepartment}`
  );

  return isDepartment;
}

// Find department in hierarchy
async function findDepartmentPath(departmentPath, hierarchy, currentLevel = 0) {
  if (!departmentPath || !hierarchy || departmentPath.length === 0) return [];

  const currentDeptName = safeTrim(departmentPath[0]);
  const remainingPath = departmentPath.slice(1);

  for (const dept of hierarchy) {
    const deptName = safeTrim(dept.ner);

    // Exact match
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
        if (nestedResult.length > 0) {
          return result.concat(nestedResult);
        }
      }

      return result;
    }

    // Fuzzy match - check if department name contains the search term or vice versa
    if (
      deptName.toLowerCase().includes(currentDeptName.toLowerCase()) ||
      currentDeptName.toLowerCase().includes(deptName.toLowerCase())
    ) {
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
        if (nestedResult.length > 0) {
          return result.concat(nestedResult);
        }
      }

      return result;
    }

    // Special case: if searching for simple numbers, try to match with department names that contain those numbers
    if (/^\d+$/.test(currentDeptName)) {
      const deptNameNumbers = deptName.match(/\d+/g);
      if (deptNameNumbers && deptNameNumbers.includes(currentDeptName)) {
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
          if (nestedResult.length > 0) {
            return result.concat(nestedResult);
          }
        }

        return result;
      }
    }

    // If no match found at current level, search in sub-departments
    if (dept.dedKhesguud && dept.dedKhesguud.length > 0) {
      const nestedResult = await findDepartmentPath(
        departmentPath,
        dept.dedKhesguud,
        currentLevel + 1
      );
      if (nestedResult.length > 0) {
        return nestedResult;
      }
    }
  }

  return [];
}

// Get flat department list
async function getFlatDepartments() {
  const allDepartments = await Buleg.find({});
  return getAllDepartmentsFlat(allDepartments);
}

// Get flat department list from existing departments array
function getAllDepartmentsFlat(allDepartments) {
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

// Find parent departments for a given department
function findParentDepartments(targetDept, allDepartments, currentPath = []) {
  const parents = [];

  function searchParents(dept, level = 0) {
    if (dept._id.toString() === targetDept._id.toString()) {
      // Found the target department, return the current path as parents
      return currentPath.map((parent, index) => ({
        _id: parent._id,
        ner: parent.ner,
        level: index,
      }));
    }

    if (dept.dedKhesguud && dept.dedKhesguud.length > 0) {
      for (const subDept of dept.dedKhesguud) {
        const result = searchParents(subDept, level + 1, [
          ...currentPath,
          dept,
        ]);
        if (result) return result;
      }
    }

    return null;
  }

  for (const dept of allDepartments) {
    const result = searchParents(dept);
    if (result) return result;
  }

  return [];
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
          // Check if this column contains department-like data by examining sample values
          const isDepartmentColumn = checkIfDepartmentColumn(
            worksheet,
            column,
            data
          );
          if (isDepartmentColumn) {
            if (!columnMap.departments) columnMap.departments = [];
            columnMap.departments.push({
              column,
              name: header,
            });
          } else {
            // Fallback: if it's not a basic employee field and has data, treat it as department
            const hasData = data.slice(1, 4).some((row) => {
              const value = row[usegTooruuKhurvuulekh(column)];
              return value && String(value).trim() !== "";
            });

            if (hasData) {
              console.log(
                `Column ${column} (${header}): Treating as department column (fallback)`
              );
              if (!columnMap.departments) columnMap.departments = [];
              columnMap.departments.push({
                column,
                name: header,
              });
            }
          }
        }
      }
    }

    const employees = [];
    let errors = "";

    // Debug: Log detected department columns
    console.log("=== DEBUGGING DEPARTMENT DETECTION ===");
    console.log("Column map:", columnMap);
    if (columnMap.departments) {
      console.log("Detected department columns:", columnMap.departments);
    } else {
      console.log("No department columns detected");
    }
    console.log("Sample data rows:", data.slice(1, 4)); // First 3 data rows

    // Force detect all columns that look like departments
    if (!columnMap.departments) {
      columnMap.departments = [];
    }

    // Check all columns for department-like headers
    for (let cell in worksheet) {
      const cellStr = cell.toString();
      if (cellStr[1] === "1" && cellStr.length === 2 && worksheet[cellStr].v) {
        const header = worksheet[cellStr].v.toString();
        const column = cellStr[0];

        // Skip basic employee fields
        if (
          header.includes("Овог") ||
          header.includes("Нэр") ||
          header.includes("Регистр") ||
          header.includes("Хувийн дугаар") ||
          header.includes("Утас")
        ) {
          continue;
        }

        // Check if this looks like a department name
        const isDepartmentLike =
          /^\d+\.\d+/.test(header) ||
          /^\d+-р түвшин/.test(header) ||
          /^[А-Я]/.test(header);

        if (isDepartmentLike) {
          const existingDept = columnMap.departments.find(
            (d) => d.column === column
          );
          if (!existingDept) {
            columnMap.departments.push({
              column: column,
              name: header,
            });
            console.log(`Added department column: ${column} -> ${header}`);
          }
        }
      }
    }

    console.log("Final department columns:", columnMap.departments);

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

      // Process department assignments - Include parent departments
      employee.departmentAssignments = [];
      console.log(`\n=== Processing Row ${i + 2} (${employee.ner}) ===`);

      if (columnMap.departments) {
        const flatDepartments = getAllDepartmentsFlat(allDepartments);
        const assignedDeptIds = new Set(); // To avoid duplicates

        console.log(
          `Available departments:`,
          flatDepartments.map((d) => d.ner)
        );
        console.log(`Department columns to check:`, columnMap.departments);

        for (const dept of columnMap.departments) {
          const cellValue = row[usegTooruuKhurvuulekh(dept.column)];
          console.log(`Column ${dept.column} (${dept.name}): "${cellValue}"`);

          // If cell has value, find matching department and its parents
          if (cellValue && safeTrim(cellValue) !== "") {
            console.log(`Looking for department: ${dept.name}`);
            const foundDept = flatDepartments.find((d) => d.ner === dept.name);
            console.log(`Found department:`, foundDept);

            if (foundDept) {
              // Add the department itself
              if (!assignedDeptIds.has(foundDept._id.toString())) {
                employee.departmentAssignments.push({
                  level: foundDept.level,
                  departmentId: foundDept._id,
                  departmentName: foundDept.ner,
                });
                assignedDeptIds.add(foundDept._id.toString());
                console.log(
                  `Added department: ${foundDept.ner} (level ${foundDept.level})`
                );
              }

              // Add all parent departments
              const parentPath = findParentDepartments(
                foundDept,
                allDepartments
              );
              console.log(`Parent path for ${foundDept.ner}:`, parentPath);

              for (const parent of parentPath) {
                if (!assignedDeptIds.has(parent._id.toString())) {
                  employee.departmentAssignments.push({
                    level: parent.level,
                    departmentId: parent._id,
                    departmentName: parent.ner,
                  });
                  assignedDeptIds.add(parent._id.toString());
                  console.log(
                    `Added parent: ${parent.ner} (level ${parent.level})`
                  );
                }
              }
            } else {
              console.log(`Department not found: ${dept.name}`);
            }
          }
        }

        console.log(
          `Final assignments for ${employee.ner}:`,
          employee.departmentAssignments.map((a) => a.departmentName)
        );
      } else {
        console.log(`No department columns detected for ${employee.ner}`);
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
      "attachment; filename*=UTF-8''ajiltan_template.xlsx"
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
      `attachment; filename*=UTF-8''${encodeURIComponent(
        department.ner
      )}_template.xlsx`
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
      "attachment; filename*=UTF-8''ajiltanuud.xlsx"
    );

    return workbook.xlsx.write(res).then(() => res.status(200).end());
  } catch (error) {
    next(error);
  }
});
