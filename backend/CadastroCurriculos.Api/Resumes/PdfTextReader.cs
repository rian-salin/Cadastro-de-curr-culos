using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

namespace CadastroCurriculos.Api.Resumes;

public static class PdfTextReader
{
    public static string ReadText(byte[] pdfBytes)
    {
        try
        {
            using var document = PdfDocument.Open(pdfBytes);

            // ContentOrderTextExtractor preserva as quebras de linha, de que a heurística do nome
            // depende; o page.Text sai na ordem interna do arquivo, sem quebras.
            return string.Join('\n', document.GetPages().Select(page => ContentOrderTextExtractor.GetText(page)));
        }
        catch (Exception ex)
        {
            // Arquivo malformado, protegido por senha etc.: o PdfPig lança tipos variados.
            throw new PdfReadException(ex);
        }
    }
}
