using CadastroCurriculos.Api.Contracts;
using CadastroCurriculos.Api.Data;
using CadastroCurriculos.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace CadastroCurriculos.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CandidatesController : ControllerBase
{
    private const int SqlUniqueIndexViolation = 2601;
    private const int SqlUniqueConstraintViolation = 2627;

    private readonly AppDbContext _dbContext;
    private readonly ILogger<CandidatesController> _logger;

    public CandidatesController(AppDbContext dbContext, ILogger<CandidatesController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<CandidateResponse>> Create(CreateCandidateRequest request, CancellationToken cancellationToken)
    {
        var candidate = new Candidate
        {
            FullName = request.FullName!,
            Email = request.Email!,
            Phone = request.Phone,
            AreaOfInterest = request.AreaOfInterest,
            ProfessionalSummary = request.ProfessionalSummary,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        _dbContext.Candidates.Add(candidate);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            _logger.LogInformation("Candidate creation rejected: e-mail already registered");
            ModelState.AddModelError("email", "Já existe um candidato com este e-mail.");
            return ValidationProblem(
                title: "Candidato já cadastrado.",
                statusCode: StatusCodes.Status409Conflict,
                modelStateDictionary: ModelState);
        }

        return CreatedAtAction(nameof(GetById), new { id = candidate.Id }, CandidateResponse.FromEntity(candidate));
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CandidateSummaryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var candidates = await _dbContext.Candidates
            .AsNoTracking()
            .OrderByDescending(c => c.CreatedAt)
            .ThenByDescending(c => c.Id)
            .Select(c => new CandidateSummaryResponse(c.Id, c.FullName, c.Email, c.AreaOfInterest, c.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(candidates);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CandidateResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        var candidate = await _dbContext.Candidates
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (candidate is null)
        {
            return Problem(title: "Candidato não encontrado.", statusCode: StatusCodes.Status404NotFound);
        }

        return CandidateResponse.FromEntity(candidate);
    }

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is SqlException { Number: SqlUniqueIndexViolation or SqlUniqueConstraintViolation };
}
