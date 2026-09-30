namespace CadastroCurriculos.Api.Resumes;

public class PdfReadException(Exception innerException)
    : Exception("Could not read the PDF file.", innerException);
