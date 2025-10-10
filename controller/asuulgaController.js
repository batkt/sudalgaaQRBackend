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

    // Map column headers - improved logic
    const columnMap = {};
    const allDepartments = await Buleg.find({});
    const departmentHierarchy =
      getDepartmentHierarchyForTemplate(allDepartments);

    console.log("=== COLUMN MAPPING DEBUG ===");
    console.log("Available data rows:", data.length);
    console.log("First few rows:", data.slice(0, 3));

    // First pass: map basic employee fields
    for (let cell in worksheet) {
      const cellStr = cell.toString();
      if (cellStr[1] === "1" && cellStr.length === 2 && worksheet[cellStr].v) {
        const header = worksheet[cellStr].v.toString().trim();
        const column = cellStr[0];
        const columnIndex = usegTooruuKhurvuulekh(column);

        console.log(`Checking header: "${header}" at column ${column} (index ${columnIndex})`);

        // Map basic employee fields with more flexible matching
        if (header.includes("Овог") || header === "Овог") {
          columnMap.ovog = column;
          console.log(`Mapped Овог to column ${column}`);
        } else if ((header.includes("Нэр") && !header.includes("дуудлага")) || header === "Нэр") {
          columnMap.ner = column;
          console.log(`Mapped Нэр to column ${column}`);
        } else if (header.includes("Регистр") || header === "Регистр") {
          columnMap.register = column;
          console.log(`Mapped Регистр to column ${column}`);
        } else if (header.includes("Хувийн дугаар") || header === "Хувийн дугаар") {
          columnMap.nevtrekhNer = column;
          console.log(`Mapped Хувийн дугаар to column ${column}`);
        } else if (header.includes("Утас") || header === "Утас") {
          columnMap.utas = column;
          console.log(`Mapped Утас to column ${column}`);
        } else if (header.includes("Эрх") || header === "Эрх") {
          columnMap.erkh = column;
          console.log(`Mapped Эрх to column ${column}`);
        }
      }
    }

    // Second pass: map department columns dynamically
    columnMap.departments = [];
    const flatDepartments = getAllDepartmentsFlat(allDepartments);
    
    for (let cell in worksheet) {
      const cellStr = cell.toString();
      if (cellStr[1] === "1" && cellStr.length === 2 && worksheet[cellStr].v) {
        const header = worksheet[cellStr].v.toString().trim();
        const column = cellStr[0];

        // Skip already mapped basic fields
        if (
          header.includes("Овог") ||
          header.includes("Нэр") ||
          header.includes("Регистр") ||
          header.includes("Хувийн дугаар") ||
          header.includes("Утас") ||
          header.includes("Эрх") ||
          header.includes("№") ||
          header.includes("Зураг")
        ) {
          continue;
        }

        // Check if this header matches any existing department name
        const matchingDept = flatDepartments.find(dept => dept.ner === header);
        
        if (matchingDept) {
          columnMap.departments.push({
            column: column,
            name: header,
            departmentId: matchingDept._id,
            level: matchingDept.level
          });
          console.log(`Mapped department: ${column} -> ${header} (ID: ${matchingDept._id})`);
        } else {
          // Fallback: check if it looks like a department name
          const isDepartmentLike =
            /^\d+\.\d+/.test(header) ||
            /^\d+-р түвшин/.test(header) ||
            /^[А-Я]/.test(header) ||
            header.includes("ШШГ") ||
            header.includes("газар") ||
            header.includes("алба") ||
            header.includes("хэлтэс") ||
            header.includes("тасаг") ||
            header.includes("бүлэг");

          if (isDepartmentLike) {
            columnMap.departments.push({
              column: column,
              name: header,
            });
            console.log(`Mapped department (fallback): ${column} -> ${header}`);
          }
        }
      }
    }

    const employees = [];
    let errors = "";

    // Debug: Log detected columns
    console.log("=== FINAL COLUMN MAPPING ===");
    console.log("Column map:", columnMap);
    console.log("Detected department columns:", columnMap.departments);
    console.log("Sample data rows:", data.slice(1, 4)); // First 3 data rows

    for (let i = 1; i < data.length; i++) { // Start from row 1 (skip header)
      const row = data[i];

      // Skip empty rows
      if (!row || row.length === 0) {
        continue;
      }

      // Extract employee data with proper null checking
      const ovog = columnMap.ovog ? safeTrim(row[usegTooruuKhurvuulekh(columnMap.ovog)]) : "";
      const ner = columnMap.ner ? safeTrim(row[usegTooruuKhurvuulekh(columnMap.ner)]) : "";
      const register = columnMap.register ? safeTrim(row[usegTooruuKhurvuulekh(columnMap.register)]) : "";
      const utas = columnMap.utas ? safeTrim(row[usegTooruuKhurvuulekh(columnMap.utas)]) : "";
      const nevtrekhNer = columnMap.nevtrekhNer ? safeTrim(row[usegTooruuKhurvuulekh(columnMap.nevtrekhNer)]) : "";
      const erkh = columnMap.erkh ? safeTrim(row[usegTooruuKhurvuulekh(columnMap.erkh)]) : "";

      console.log(`\n=== Processing Row ${i + 1} ===`);
      console.log(`Овог: "${ovog}"`);
      console.log(`Нэр: "${ner}"`);
      console.log(`Регистр: "${register}"`);
      console.log(`Утас: "${utas}"`);
      console.log(`Хувийн дугаар: "${nevtrekhNer}"`);
      console.log(`Эрх: "${erkh}"`);

      // Skip rows without essential data
      if (!ner && !register) {
        console.log(`Skipping row ${i + 1}: No name or register`);
        continue;
      }

      // Validate required fields
      if (!ner) {
        errors += `Мөр ${i + 1}: Нэр заавал оруулна уу.\n`;
        continue;
      }

      if (!register) {
        errors += `Мөр ${i + 1}: Регистрийн дугаар заавал оруулна уу.\n`;
        continue;
      }

      // Check for duplicate register
      const existingEmployee = await Ajiltan.findOne({ register });
      if (existingEmployee) {
        errors += `Мөр ${i + 1}: ${register} регистрийн дугаартай ажилтан бүртгэгдсэн байна.\n`;
        continue;
      }

      const employee = new Ajiltan({
        ovog: ovog || "",
        ner: ner,
        register: register,
        utas: utas || "",
        nevtrekhNer: nevtrekhNer || "",
        erkh: erkh || "",
        nuutsUg: "123",
      });

      // Process department assignments
      employee.departmentAssignments = [];
      console.log(`\n=== Processing Departments for ${employee.ner} ===`);

      if (columnMap.departments && columnMap.departments.length > 0) {
        const flatDepartments = getAllDepartmentsFlat(allDepartments);
        const assignedDeptIds = new Set(); // To avoid duplicates

        console.log(`Available departments:`, flatDepartments.map((d) => d.ner));
        console.log(`Department columns to check:`, columnMap.departments);

        for (const dept of columnMap.departments) {
          const cellValue = row[usegTooruuKhurvuulekh(dept.column)];
          console.log(`Column ${dept.column} (${dept.name}): "${cellValue}"`);

          // If cell has value, process department assignment
          if (cellValue && safeTrim(cellValue) !== "") {
            console.log(`Processing department assignment for: ${dept.name}`);
            
            // If we have departmentId from mapping, use it directly
            if (dept.departmentId) {
              const foundDept = flatDepartments.find((d) => d._id.toString() === dept.departmentId.toString());
              
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
                console.log(`Department not found in flat list: ${dept.name}`);
              }
            } else {
              // Fallback: search by name
              const foundDept = flatDepartments.find((d) => d.ner === dept.name);
              console.log(`Found department by name:`, foundDept);

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

// Generate dynamic columns based on actual department hierarchy
function generateDynamicColumns(departments) {
  const basicColumns = [
    { header: "№", key: "№", width: 10 },
    { header: "Зураг", key: "Зураг", width: 15 },
    { header: "Овог", key: "Овог", width: 20 },
    { header: "Нэр", key: "Нэр", width: 20 },
    { header: "Регистр", key: "Регистр", width: 20 },
    { header: "Хувийн дугаар", key: "Хувийн дугаар", width: 20 },
    { header: "Утас", key: "Утас", width: 20 },
    { header: "Эрх", key: "Эрх", width: 20 },
  ];

  // Get all department paths from the hierarchy
  const departmentPaths = getAllDepartmentPaths(departments);
  
  // Create columns for each department level
  const departmentColumns = [];
  const maxLevel = Math.max(...departmentPaths.map(path => path.length - 1));
  
  for (let level = 0; level <= maxLevel; level++) {
    const levelDepartments = departmentPaths
      .filter(path => path.length > level)
      .map(path => path[level])
      .filter((dept, index, arr) => arr.findIndex(d => d._id.toString() === dept._id.toString()) === index); // Remove duplicates
    
    levelDepartments.forEach(dept => {
      departmentColumns.push({
        header: dept.ner,
        key: `dept_${dept._id}`,
        width: 25,
        level: level,
        departmentId: dept._id
      });
    });
  }

  return [...basicColumns, ...departmentColumns];
}

// Get all possible department paths from hierarchy
function getAllDepartmentPaths(departments, currentPath = []) {
  const paths = [];
  
  for (const dept of departments) {
    const newPath = [...currentPath, { _id: dept._id, ner: dept.ner, level: currentPath.length }];
    paths.push(newPath);
    
    if (dept.dedKhesguud && dept.dedKhesguud.length > 0) {
      const subPaths = getAllDepartmentPaths(dept.dedKhesguud, newPath);
      paths.push(...subPaths);
    }
  }
  
  return paths;
}

// Excel Template Download
exports.ajiltanZagvarAvya = asyncHandler(async (req, res, next) => {
  try {
    const allDepartments = await Buleg.find({});
    
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet("Ажилтан");

    // Generate dynamic columns based on actual department hierarchy
    const columns = generateDynamicColumns(allDepartments);
    
    console.log("Generated dynamic columns:", columns.map(c => c.header));
    
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

// Get Dynamic Template Structure
exports.getDynamicTemplateStructure = asyncHandler(async (req, res, next) => {
  try {
    const allDepartments = await Buleg.find({});
    const dynamicColumns = generateDynamicColumns(allDepartments);
    
    // Group columns by type
    const basicColumns = dynamicColumns.filter(col => 
      ['№', 'Зураг', 'Овог', 'Нэр', 'Регистр', 'Хувийн дугаар', 'Утас', 'Эрх'].includes(col.header)
    );
    
    const departmentColumns = dynamicColumns.filter(col => 
      !['№', 'Зураг', 'Овог', 'Нэр', 'Регистр', 'Хувийн дугаар', 'Утас', 'Эрх'].includes(col.header)
    );
    
    // Group department columns by level
    const departmentColumnsByLevel = {};
    departmentColumns.forEach(col => {
      if (!departmentColumnsByLevel[col.level]) {
        departmentColumnsByLevel[col.level] = [];
      }
      departmentColumnsByLevel[col.level].push(col);
    });

    res.status(200).json({ 
      success: true, 
      data: {
        basicColumns,
        departmentColumns,
        departmentColumnsByLevel,
        totalColumns: dynamicColumns.length,
        structure: {
          basicFields: basicColumns.length,
          departmentLevels: Object.keys(departmentColumnsByLevel).length,
          totalDepartments: departmentColumns.length
        }
      }
    });
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

    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet("Ажилтан");

    // Generate dynamic columns for this specific department
    const columns = generateDynamicColumns([department]);
    
    console.log(`Generated dynamic columns for ${department.ner}:`, columns.map(c => c.header));
    
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
    const allDepartments = await Buleg.find({});
    
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet("Ажилтан");

    // Generate dynamic headers based on actual department structure
    const dynamicColumns = generateDynamicColumns(allDepartments);
    const headers = dynamicColumns.map(col => col.header);
    
    console.log("Export headers:", headers);
    
    worksheet.addRow(headers);

    employees.forEach((employee, index) => {
      const row = [];
      
      // Add basic employee data
      row.push(index + 1); // №
      row.push(""); // Зураг (empty for now)
      row.push(employee.ovog || "");
      row.push(employee.ner || "");
      row.push(employee.register || "");
      row.push(employee.nevtrekhNer || "");
      row.push(employee.utas || "");
      row.push(employee.erkh || "");
      
      // Add department data for each column
      const departmentAssignments = employee.departmentAssignments || [];
      
      for (let i = 8; i < dynamicColumns.length; i++) { // Skip basic columns
        const column = dynamicColumns[i];
        
        if (column.departmentId) {
          // Find if this employee is assigned to this department
          const assignment = departmentAssignments.find(
            assignment => assignment.departmentId.toString() === column.departmentId.toString()
          );
          
          if (assignment) {
            row.push("✓"); // Mark with checkmark if assigned
          } else {
            row.push(""); // Empty if not assigned
          }
        } else {
          row.push(""); // Empty for non-department columns
        }
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
