// Predefined NEET Biology Question Templates
// Based on NEET 2016-2025 analysis data

export const PREDEFINED_TEMPLATES = [
    {
        template_name: "NEET 2025 Pattern",
        description: "Based on actual NEET 2025 question distribution - 50 questions total",
        total_questions: 79,
        is_predefined: true,
        class_11_distribution: {
            "Biological Classification": { min: 1, max: 3, target: 2 },
            "Plant Kingdom": { min: 2, max: 4, target: 3 },
            "Animal Kingdom": { min: 2, max: 4, target: 3 },
            "Morphology of Flowering Plants": { min: 2, max: 4, target: 3 },
            "Anatomy of Flowering Plants": { min: 2, max: 4, target: 3 },
            "Structural Organisation in Animals": { min: 3, max: 5, target: 4 },
            "Cell: The Unit of Life": { min: 2, max: 4, target: 3 },
            "Biomolecules": { min: 3, max: 5, target: 4 },
            "Cell Cycle and Cell Division": { min: 3, max: 5, target: 4 },
            "Photosynthesis in Higher Plants": { min: 1, max: 3, target: 2 },
            "Respiration in Plants": { min: 1, max: 3, target: 2 },
            "Plant Growth and Development": { min: 2, max: 4, target: 3 }
        },
        class_12_distribution: {
            "Sexual Reproduction in Flowering Plants": { min: 2, max: 4, target: 3 },
            "Human Reproduction": { min: 3, max: 5, target: 4 },
            "Reproductive Health": { min: 1, max: 3, target: 2 },
            "Principles of Inheritance and Variation": { min: 4, max: 6, target: 5 },
            "Molecular Basis of Inheritance": { min: 6, max: 9, target: 7 },
            "Evolution": { min: 2, max: 4, target: 3 },
            "Human Health and Disease": { min: 2, max: 4, target: 3 },
            "Biotechnology: Principles and Processes": { min: 4, max: 6, target: 5 },
            "Biotechnology and its Applications": { min: 2, max: 4, target: 3 },
            "Organisms and Populations": { min: 2, max: 4, target: 3 },
            "Ecosystem": { min: 1, max: 3, target: 2 },
            "Biodiversity and Conservation": { min: 2, max: 4, target: 3 }
        }
    },

    {
        template_name: "High Weightage Focus",
        description: "Concentrates on historically high-weightage chapters - ideal for targeted preparation",
        total_questions: 61,
        is_predefined: true,
        class_11_distribution: {
            "Animal Kingdom": { min: 2, max: 4, target: 3 },
            "Structural Organisation in Animals": { min: 4, max: 6, target: 5 },
            "Cell: The Unit of Life": { min: 3, max: 5, target: 4 },
            "Biomolecules": { min: 4, max: 6, target: 5 },
            "Cell Cycle and Cell Division": { min: 4, max: 6, target: 5 },
            "Plant Kingdom": { min: 2, max: 3, target: 2 },
            "Morphology of Flowering Plants": { min: 2, max: 3, target: 2 }
        },
        class_12_distribution: {
            "Molecular Basis of Inheritance": { min: 8, max: 10, target: 9 },
            "Principles of Inheritance and Variation": { min: 6, max: 8, target: 7 },
            "Biotechnology: Principles and Processes": { min: 5, max: 7, target: 6 },
            "Human Reproduction": { min: 3, max: 5, target: 4 },
            "Sexual Reproduction in Flowering Plants": { min: 2, max: 4, target: 3 },
            "Evolution": { min: 2, max: 4, target: 3 },
            "Human Health and Disease": { min: 2, max: 4, target: 3 }
        }
    },

    {
        template_name: "Balanced All-Chapter",
        description: "Equal coverage of all NEET Biology chapters - comprehensive preparation",
        total_questions: 50,
        is_predefined: true,
        class_11_distribution: {
            "The Living World": { min: 1, max: 2, target: 1 },
            "Biological Classification": { min: 1, max: 2, target: 1 },
            "Plant Kingdom": { min: 1, max: 2, target: 2 },
            "Animal Kingdom": { min: 1, max: 2, target: 2 },
            "Morphology of Flowering Plants": { min: 1, max: 2, target: 2 },
            "Anatomy of Flowering Plants": { min: 1, max: 2, target: 2 },
            "Structural Organisation in Animals": { min: 1, max: 2, target: 2 },
            "Cell: The Unit of Life": { min: 1, max: 2, target: 2 },
            "Biomolecules": { min: 1, max: 2, target: 2 },
            "Cell Cycle and Cell Division": { min: 1, max: 2, target: 2 },
            "Photosynthesis in Higher Plants": { min: 1, max: 2, target: 1 },
            "Respiration in Plants": { min: 1, max: 2, target: 1 },
            "Plant Growth and Development": { min: 1, max: 2, target: 1 },
            "Breathing and Exchange of Gases": { min: 1, max: 2, target: 1 },
            "Body Fluids and Circulation": { min: 1, max: 2, target: 1 },
            "Excretory Products and their Elimination": { min: 1, max: 2, target: 1 },
            "Locomotion and Movement": { min: 1, max: 2, target: 1 },
            "Neural Control and Coordination": { min: 1, max: 2, target: 1 },
            "Chemical Coordination and Integration": { min: 1, max: 2, target: 1 }
        },
        class_12_distribution: {
            "Sexual Reproduction in Flowering Plants": { min: 1, max: 2, target: 2 },
            "Human Reproduction": { min: 1, max: 2, target: 2 },
            "Reproductive Health": { min: 1, max: 2, target: 1 },
            "Principles of Inheritance and Variation": { min: 1, max: 2, target: 2 },
            "Molecular Basis of Inheritance": { min: 2, max: 3, target: 2 },
            "Evolution": { min: 1, max: 2, target: 2 },
            "Human Health and Disease": { min: 1, max: 2, target: 2 },
            "Microbes in Human Welfare": { min: 1, max: 2, target: 1 },
            "Biotechnology: Principles and Processes": { min: 1, max: 2, target: 2 },
            "Biotechnology and its Applications": { min: 1, max: 2, target: 2 },
            "Organisms and Populations": { min: 1, max: 2, target: 2 },
            "Ecosystem": { min: 1, max: 2, target: 1 },
            "Biodiversity and Conservation": { min: 1, max: 2, target: 2 }
        }
    },

    {
        template_name: "Class XI Focused",
        description: "Emphasis on Class XI chapters - 35 questions from XI, 15 from XII",
        total_questions: 50,
        is_predefined: true,
        class_11_distribution: {
            "Biological Classification": { min: 1, max: 3, target: 2 },
            "Plant Kingdom": { min: 2, max: 4, target: 3 },
            "Animal Kingdom": { min: 2, max: 4, target: 3 },
            "Morphology of Flowering Plants": { min: 2, max: 4, target: 3 },
            "Anatomy of Flowering Plants": { min: 2, max: 4, target: 3 },
            "Structural Organisation in Animals": { min: 3, max: 5, target: 4 },
            "Cell: The Unit of Life": { min: 2, max: 4, target: 3 },
            "Biomolecules": { min: 3, max: 5, target: 4 },
            "Cell Cycle and Cell Division": { min: 3, max: 5, target: 4 },
            "Photosynthesis in Higher Plants": { min: 1, max: 3, target: 2 },
            "Respiration in Plants": { min: 1, max: 3, target: 2 },
            "Plant Growth and Development": { min: 1, max: 3, target: 2 }
        },
        class_12_distribution: {
            "Molecular Basis of Inheritance": { min: 3, max: 5, target: 4 },
            "Principles of Inheritance and Variation": { min: 2, max: 4, target: 3 },
            "Biotechnology: Principles and Processes": { min: 2, max: 4, target: 3 },
            "Human Reproduction": { min: 2, max: 3, target: 2 },
            "Evolution": { min: 1, max: 2, target: 1 },
            "Human Health and Disease": { min: 1, max: 2, target: 1 },
            "Organisms and Populations": { min: 1, max: 2, target: 1 }
        }
    },

    {
        template_name: "Class XII Focused",
        description: "Emphasis on Class XII chapters - 35 questions from XII, 15 from XI",
        total_questions: 50,
        is_predefined: true,
        class_11_distribution: {
            "Cell: The Unit of Life": { min: 2, max: 3, target: 2 },
            "Biomolecules": { min: 2, max: 3, target: 2 },
            "Cell Cycle and Cell Division": { min: 2, max: 3, target: 2 },
            "Structural Organisation in Animals": { min: 2, max: 3, target: 2 },
            "Animal Kingdom": { min: 1, max: 2, target: 2 },
            "Plant Kingdom": { min: 1, max: 2, target: 2 },
            "Morphology of Flowering Plants": { min: 1, max: 2, target: 2 },
            "Photosynthesis in Higher Plants": { min: 1, max: 2, target: 1 }
        },
        class_12_distribution: {
            "Molecular Basis of Inheritance": { min: 7, max: 9, target: 8 },
            "Principles of Inheritance and Variation": { min: 5, max: 7, target: 6 },
            "Biotechnology: Principles and Processes": { min: 4, max: 6, target: 5 },
            "Human Reproduction": { min: 3, max: 5, target: 4 },
            "Sexual Reproduction in Flowering Plants": { min: 2, max: 4, target: 3 },
            "Evolution": { min: 2, max: 4, target: 3 },
            "Human Health and Disease": { min: 2, max: 3, target: 2 },
            "Biotechnology and its Applications": { min: 2, max: 3, target: 2 },
            "Organisms and Populations": { min: 1, max: 2, target: 1 },
            "Biodiversity and Conservation": { min: 1, max: 2, target: 1 }
        }
    },

    {
        template_name: "Recent 3-Year Trend (2023-2025)",
        description: "Average distribution based on NEET 2023, 2024, and 2025 patterns",
        total_questions: 50,
        is_predefined: true,
        class_11_distribution: {
            "Biological Classification": { min: 1, max: 3, target: 2 },
            "Plant Kingdom": { min: 2, max: 4, target: 3 },
            "Animal Kingdom": { min: 2, max: 4, target: 3 },
            "Morphology of Flowering Plants": { min: 2, max: 4, target: 3 },
            "Anatomy of Flowering Plants": { min: 2, max: 4, target: 3 },
            "Structural Organisation in Animals": { min: 3, max: 5, target: 4 },
            "Cell: The Unit of Life": { min: 2, max: 4, target: 3 },
            "Biomolecules": { min: 3, max: 5, target: 4 },
            "Cell Cycle and Cell Division": { min: 3, max: 5, target: 4 },
            "Photosynthesis in Higher Plants": { min: 1, max: 3, target: 2 },
            "Respiration in Plants": { min: 1, max: 3, target: 2 }
        },
        class_12_distribution: {
            "Sexual Reproduction in Flowering Plants": { min: 2, max: 4, target: 3 },
            "Human Reproduction": { min: 3, max: 5, target: 4 },
            "Reproductive Health": { min: 1, max: 3, target: 2 },
            "Principles of Inheritance and Variation": { min: 4, max: 6, target: 5 },
            "Molecular Basis of Inheritance": { min: 6, max: 8, target: 7 },
            "Evolution": { min: 2, max: 4, target: 3 },
            "Human Health and Disease": { min: 2, max: 4, target: 3 },
            "Biotechnology: Principles and Processes": { min: 4, max: 6, target: 5 },
            "Biotechnology and its Applications": { min: 2, max: 4, target: 3 },
            "Organisms and Populations": { min: 2, max: 4, target: 3 },
            "Biodiversity and Conservation": { min: 2, max: 4, target: 3 }
        }
    }
];

// Helper function to calculate total questions from distribution
export const calculateTotalQuestions = (class11Dist, class12Dist) => {
    const total11 = Object.values(class11Dist).reduce((sum, chapter) => sum + (chapter.target || 0), 0);
    const total12 = Object.values(class12Dist).reduce((sum, chapter) => sum + (chapter.target || 0), 0);
    return total11 + total12;
};

// Validate template distribution
export const validateTemplate = (template) => {
    const calculatedTotal = calculateTotalQuestions(
        template.class_11_distribution,
        template.class_12_distribution
    );

    return {
        isValid: calculatedTotal === template.total_questions,
        calculatedTotal,
        expectedTotal: template.total_questions
    };
};
