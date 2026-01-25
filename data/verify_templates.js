// Script to verify and correct predefined template totals

const templates = [
    {
        name: "NEET 2025 Pattern",
        class11: {
            "Biological Classification": 2,
            "Plant Kingdom": 3,
            "Animal Kingdom": 3,
            "Morphology of Flowering Plants": 3,
            "Anatomy of Flowering Plants": 3,
            "Structural Organisation in Animals": 4,
            "Cell: The Unit of Life": 3,
            "Biomolecules": 4,
            "Cell Cycle and Cell Division": 4,
            "Photosynthesis in Higher Plants": 2,
            "Respiration in Plants": 2,
            "Plant Growth and Development": 3
        },
        class12: {
            "Sexual Reproduction in Flowering Plants": 3,
            "Human Reproduction": 4,
            "Reproductive Health": 2,
            "Principles of Inheritance and Variation": 5,
            "Molecular Basis of Inheritance": 7,
            "Evolution": 3,
            "Human Health and Disease": 3,
            "Biotechnology: Principles and Processes": 5,
            "Biotechnology and its Applications": 3,
            "Organisms and Populations": 3,
            "Ecosystem": 2,
            "Biodiversity and Conservation": 3
        }
    }
];

// Calculate totals
templates.forEach(template => {
    const class11Total = Object.values(template.class11).reduce((sum, val) => sum + val, 0);
    const class12Total = Object.values(template.class12).reduce((sum, val) => sum + val, 0);
    const grandTotal = class11Total + class12Total;

    console.log(`\n${template.name}:`);
    console.log(`  Class XI: ${class11Total} questions`);
    console.log(`  Class XII: ${class12Total} questions`);
    console.log(`  Grand Total: ${grandTotal} questions`);
});
